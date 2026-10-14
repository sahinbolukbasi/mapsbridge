import { apiFetch } from '../api-client';
import { CheckoutPayload, CheckoutResult } from './billing-types';

export function getStripeConfig() {
  const key=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  return {publishableKey:key,isLive:key.startsWith('pk_live_'),currency:'try' as const};
}
/** Both Stripe test and live modes use the authenticated server. No simulated success fallback. */
export async function createStripeCheckoutSession(payload: CheckoutPayload): Promise<CheckoutResult> {
  try {
    const session=await apiFetch<{url:string}>('/stripe/checkout',{
      method:'POST',headers:{'idempotency-key':crypto.randomUUID()},
      // Never send raw card data, client prices or user IDs.
      body:JSON.stringify({mode:payload.mode,targetId:payload.targetId,cycle:payload.cycle || 'monthly'}),
    });
    const url=new URL(session.url);
    if (url.protocol!=='https:' || url.hostname!=='checkout.stripe.com') throw new Error('Ödeme adresi doğrulanamadı.');
    return {success:true,message:'Güvenli ödeme sayfasına yönlendiriliyorsunuz.',stripeRedirectUrl:url.href};
  } catch (err: any) {return {success:false,message:err?.message || 'Ödeme başlatılamadı. Hesabınıza kredi eklenmedi.'};}
}
export async function openStripeBillingPortal(): Promise<void> {
  const data=await apiFetch<{url:string}>('/stripe/portal',{method:'POST',body:'{}'});
  const url=new URL(data.url);
  if (url.protocol!=='https:' || url.hostname!=='billing.stripe.com') throw new Error('Ödeme adresi doğrulanamadı.');
  window.location.href=url.href;
}
