'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { supabaseConfigured } from '@/lib/env';

export interface HeaderViewer {
  /** null while still unknown — the first paint cannot know. */
  signedIn: boolean | null;
  isStaff: boolean;
}

/**
 * Is anyone signed in, for the header only.
 *
 * Read in the browser rather than on the server, and that is a deliberate
 * trade. The header sits in the root layout, so asking the server would mean
 * reading cookies there — which turns every marketing page dynamic and throws
 * away the static rendering the catalogue depends on for SEO. Chrome is not
 * worth that.
 *
 * The cost is one frame where a signed-in visitor still sees "Connexion".
 * `signedIn: null` marks that moment so the header can hold the space instead
 * of flipping layout underneath a cursor.
 *
 * This is presentation only. Nothing here guards anything: the dashboard is
 * protected by the middleware and by the RLS policies, both of which hold
 * whatever this hook believes.
 */
export function useViewer(): HeaderViewer {
  const [viewer, setViewer] = useState<HeaderViewer>({ signedIn: null, isStaff: false });

  useEffect(() => {
    if (!supabaseConfigured) {
      setViewer({ signedIn: false, isStaff: false });
      return;
    }

    const supabase = createClient();
    let alive = true;

    const read = async (userId: string | undefined) => {
      if (!userId) {
        if (alive) setViewer({ signedIn: false, isStaff: false });
        return;
      }
      // RLS lets a person read only their own profile, so this returns their
      // row or nothing. A student cannot make it say 'admin'.
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (alive) {
        setViewer({
          signedIn: true,
          isStaff: data?.role === 'admin' || data?.role === 'instructor',
        });
      }
    };

    void supabase.auth.getUser().then(({ data }) => read(data.user?.id));

    // Signing out in another tab has to be reflected here too, or the header
    // keeps offering a dashboard that now redirects to the login page.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void read(session?.user?.id);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return viewer;
}
