export type ApplePlatform = "ios" | "mac";
export interface AppleSearchInput { term:string; country:string; platform:ApplePlatform; limit?:number; }
export interface AppleLookupInput { id:string|number; country:string; platform:ApplePlatform; }
export type AppleQuery = Readonly<({kind:"search";term:string;limit:number}|{kind:"lookup";id:string}) & {country:string;platform:ApplePlatform}>;
export interface AppleApp {
  readonly id:string; readonly name:string; readonly developer:string; readonly url:string; readonly icon?:string;
  readonly description:string; readonly genre:string; readonly rating:number|null; readonly ratings:number|null; readonly price:string; readonly version:string;
}
interface AppleCaptureBase { readonly id:string; readonly fetchedAt:string; readonly sourceUrl:string; readonly apps:readonly AppleApp[]; readonly notice?:string; }
export interface AppleSearchCapture extends AppleCaptureBase { readonly kind:"search"; readonly key:Readonly<Required<AppleSearchInput>>; }
export interface AppleLookupCapture extends AppleCaptureBase { readonly kind:"lookup"; readonly key:Readonly<Omit<AppleLookupInput,"id"> & {id:string}>; readonly match:"matched"|"not-found"|"platform-mismatch"; readonly notice?:string; }
export type AppleCapture = AppleSearchCapture|AppleLookupCapture;
export type AppleErrorCode = "invalid_query"|"cancelled"|"timeout"|"network"|"upstream_http"|"redirect_denied"|"provider_shape"|"platform_mismatch"|"response_too_large";
export class AppleCollectionError extends Error { readonly code:AppleErrorCode; readonly status:number; readonly retryAfter:number|null; constructor(code:AppleErrorCode,message:string,options?:{status?:number;retryAfter?:number|null}); }
export const APPLE_PROVIDER_VERSION:"apple-public-api/v1";
export const APPLE_MAX_RESPONSE_BYTES:2000000;
export const APPLE_TIMEOUT_MS:10000;
export function parseAppleAppId(value:unknown):string|null;
export function normalizeAppleQuery(input:({kind:"search"}&AppleSearchInput)|({kind:"lookup"}&AppleLookupInput)):AppleQuery;
export function appleSourceUrl(query:AppleQuery):string;
export interface AppleCollectorOptions {
  fetchImpl?:typeof fetch;
  reserve:(request:{query:AppleQuery;sourceUrl:string;signal?:AbortSignal})=>void|Promise<void>;
  now?:()=>string;
  timeoutMs?:number;
}
export function createAppleCollector(options:AppleCollectorOptions):{
  search(input:AppleSearchInput,options?:{signal?:AbortSignal}):Promise<AppleSearchCapture>;
  lookup(input:AppleLookupInput,options?:{signal?:AbortSignal}):Promise<AppleLookupCapture>;
};
