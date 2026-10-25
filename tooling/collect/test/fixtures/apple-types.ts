import {createAppleCollector,normalizeAppleQuery,appleSourceUrl,type AppleCapture,type AppleSearchCapture,type AppleLookupCapture} from "@saas-maker/collect/apple";
function checkTypes(){
const collector=createAppleCollector({reserve:async({sourceUrl,query,signal})=>{const source:string=sourceUrl;const kind:"search"|"lookup"=query.kind;void[source,kind,signal];}});
const search:Promise<AppleSearchCapture>=collector.search({term:"notes",country:"us",platform:"ios",limit:50});
const lookup:Promise<AppleLookupCapture>=collector.lookup({id:123,country:"us",platform:"mac"});
function useCapture(capture:AppleCapture){if(capture.kind==="search"){const term:string=capture.key.term;void term;}else{const id:string=capture.key.id;void id;}const count:number|null=capture.apps[0]?.ratings??null;void count;}
const url:string=appleSourceUrl(normalizeAppleQuery({kind:"search",term:"notes",country:"us",platform:"ios"}));void[search,lookup,url,useCapture];

}
void checkTypes;
