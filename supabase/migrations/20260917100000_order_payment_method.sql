-- ---------------------------------------------------------------------------
-- How the money arrived
--
-- `route` says which flow settled the order (PayPal, the desk, or free); it
-- cannot say whether the student used their PayPal balance or a card, because
-- both go through the same capture. PayPal tells us in the capture response —
-- `payment_source` — and the office asked to see it, so it is stored.
--
-- Null for the desk and for free orders: there was no PayPal payment to
-- describe, and inventing a value for them would be worse than an empty one.
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists payment_method text;

alter table public.orders
  add constraint orders_payment_method_shape check (
    payment_method is null or payment_method in ('paypal', 'card')
  );

comment on column public.orders.payment_method is
  'PayPal''s payment_source on a capture: paypal or card. Null for desk and free orders.';
