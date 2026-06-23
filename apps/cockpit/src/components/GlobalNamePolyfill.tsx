const POLYFILL =
  "(function(){if(typeof globalThis!=='undefined'&&typeof globalThis.__name!=='function'){globalThis.__name=function(t){return t};}})();";

export function GlobalNamePolyfill() {
  return <script dangerouslySetInnerHTML={{ __html: POLYFILL }} />;
}
