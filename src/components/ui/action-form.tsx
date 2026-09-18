'use client';

import {
  createContext,
  useContext,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from 'react';

/**
 * Is an ActionForm's action in flight?
 *
 * `useFormStatus` cannot answer for a form whose action is dispatched by hand
 * (see ActionForm below), which is exactly what the shared SubmitButton needs
 * to know. Wrapped forms report through this; every other form falls back to
 * `useFormStatus`, so both keep spinning.
 */
const PendingContext = createContext(false);

export function useActionPending(): boolean {
  return useContext(PendingContext);
}

/**
 * A form that does not throw away what was typed.
 *
 * React 19 resets the uncontrolled inputs of any `<form action={fn}>` when the
 * action finishes — including when it finished by returning validation errors.
 * The person then reads "this field is required" under an empty form they just
 * filled in, and has to enter everything again to fix one box.
 *
 * The opt-out is React's own: keep the `action` prop so the form still submits
 * without JavaScript, intercept `onSubmit`, prevent the native submission, and
 * run the action inside a transition. An action called by hand is not a form
 * action, so nothing is reset — on failure or on success, the fields keep what
 * was entered.
 *
 * A caller's `onSubmit` runs first, so a `window.confirm` guard can still
 * cancel the submission by preventing the default.
 */
export function ActionForm({
  action,
  children,
  onSubmit,
  ...props
}: Omit<ComponentProps<'form'>, 'action'> & {
  action: (formData: FormData) => void;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <PendingContext.Provider value={pending}>
      <form
        {...props}
        action={action}
        onSubmit={(event) => {
          onSubmit?.(event);
          if (event.defaultPrevented) return;

          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => action(formData));
        }}
      >
        {children}
      </form>
    </PendingContext.Provider>
  );
}
