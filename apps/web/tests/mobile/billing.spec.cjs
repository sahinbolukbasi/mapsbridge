const {test,expect}=require('@playwright/test');
const {prepare}=require('./fixtures.cjs');
async function setup(page,enabled=false){
 await prepare(page,{signedIn:true});
 await page.route('**/stripe/**',route=>{
 const url=new URL(route.request().url());
 const body=url.pathname.endsWith('/plans')?{enabled,products:[{id:'pack-starter',mode:'credit_pack',credits:50,amount:8900,available:enabled}]}:url.pathname.endsWith('/wallet')?{credits:5,tier:'free',welcomeGift:{credits:5,grantedAt:'2026-09-23T00:00:00Z'}}:{status:'pending'};
 return route.fulfill({json:body});
 });
}
for(const width of [320,390,768])test(`payment gift, prices and no overflow at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await setup(page);await page.goto('/checkout/');
 await expect(page.getByText('Karşılama hediyen hesabına tanımlandı.',{exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:'Satış yakında'})).toBeDisabled();
 await expect(page.getByText('Yalnız rota için kullanıldığında 10 rota')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('payment return query alone never claims successful credit',async({page})=>{
 await setup(page);await page.goto('/checkout/?success=true&session_id=cs_test_123456789');
 await expect(page.getByRole('status').filter({hasText:'Ödemen kontrol ediliyor'})).toBeVisible();
 await expect(page.getByText('Ödemen doğrulandı, kredilerin hesabına eklendi.')).toHaveCount(0);
});
test('checkout error keeps balance and presents server error',async({page})=>{
 await setup(page,true);await page.route('**/stripe/checkout',route=>route.fulfill({status:503,json:{error:'Ödeme servisi geçici olarak kapalı.'}}));
 await page.goto('/checkout/');await page.getByRole('button',{name:'Güvenli ödemeye geç'}).click();
 await expect(page.getByRole('status')).toContainText('Ödeme servisi geçici olarak kapalı');
 await expect(page.getByLabel('Kredi hesabı')).toContainText('5');
});
