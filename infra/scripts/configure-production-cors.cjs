// Add the public site origins to the existing API without replacing other settings.
const {execFileSync}=require('node:child_process');
const args=['--region','eu-central-1'];
const api=JSON.parse(execFileSync('aws',['apigatewayv2','get-api','--api-id','0duy2hfjd2',...args],{encoding:'utf8'}));
const cors={...api.CorsConfiguration,AllowMethods:[...new Set([...(api.CorsConfiguration?.AllowMethods||[]),'PATCH'])],AllowOrigins:[...new Set([...(api.CorsConfiguration?.AllowOrigins||[]),'https://mapsbridge.com','https://www.mapsbridge.com'])]};
execFileSync('aws',['apigatewayv2','update-api','--api-id',api.ApiId,'--cors-configuration',JSON.stringify(cors),...args],{stdio:'ignore'});
console.log('Existing API CORS now includes mapsbridge.com and www.mapsbridge.com. PATCH enabled for memory controls. Other settings preserved.');
