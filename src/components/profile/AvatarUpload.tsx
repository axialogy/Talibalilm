'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  beginAvatarUpload,
  confirmAvatarUpload,
  removeAvatar,
} from '@/app/actions/profile';
import { downscaleImage } from '@/lib/media/downscale';

/** A profile photo is displayed at 96–160px; 512 covers a retina screen. */
const AVATAR_MAX_WIDTH = 512;

/**
 * The profile photo, uploaded straight to Cloudflare R2.
 *
 * Three steps, and the browser only ever holds a signed URL for one object
 * under its own prefix: ask for the URL, PUT the bytes, then ask the server to
 * adopt what arrived. The server sniffs the object's real bytes before it
 * becomes a photo, and the key it was given must be one it minted for this
 * user — so a crafted key cannot adopt somebody else's picture.
 *
 * The picked file is re-encoded first, which turns an iPhone's HEIC into a
 * JPEG and keeps the object small.
 */
export function AvatarUpload({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null;
  name: string;
}) {
  const t = useTranslations('profile');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const show = (key: string) => {
    setError(t(`errors.${key}` as 'errors.saveFailed'));
  };

  async function send(file: File) {
    setError(null);
    setBusy(true);
    try {
      const prepared = await downscaleImage(file, AVATAR_MAX_WIDTH);
      const contentType = prepared.type || 'image/jpeg';

      const begin = await beginAvatarUpload({ contentType });
      if (!begin.ok) {
        show(begin.error);
        return;
      }

      const put = await fetch(begin.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: prepared,
      });
      if (!put.ok) {
        // A CORS refusal arrives here with no status and no message; the
        // diagnostics page is where that is diagnosed.
        show('uploadFailed');
        return;
      }

      const confirm = await confirmAvatarUpload(begin.key);
      if (!confirm.ok) {
        show(confirm.error);
        return;
      }

      startTransition(() => router.refresh());
    } catch {
      show('uploadFailed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setRemoving(true);
    try {
      const result = await removeAvatar();
      if (!result.ok) {
        show(result.error);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setRemoving(false);
    }
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <span className="relative flex size-28 overflow-hidden rounded-full border-4 border-white bg-brand-100 shadow-card sm:size-32">
          {avatarUrl ? (
            // A plain <img>, not next/image: the source is a short-lived R2
            // signature on a private bucket, and the optimiser cannot cache it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={name} className="size-full object-cover" />
          ) : (
            <span
              className="flex size-full items-center justify-center font-display text-4xl font-semibold text-brand-700"
              aria-hidden="true"
            >
              {initial}
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={t('avatarChange')}
          className="absolute end-0 bottom-0 flex size-10 items-center justify-center rounded-full border border-line bg-white text-ink shadow-card transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="size-4" aria-hidden="true" />
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void send(file);
          }}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">{t('avatarHint')}</p>

      {avatarUrl && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={removing}
          onClick={() => void remove()}
          className="mt-1"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {t('avatarRemove')}
        </Button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
