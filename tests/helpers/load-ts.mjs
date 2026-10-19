import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'template/package.json'));
const ts = require('typescript');
/** Execute actual TypeScript modules in Node without changing repository sources. */
export function tsLoader(read = file => fs.readFileSync(file, 'utf8')) {
  const cache = new Map();
  const load = file => {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const source = read(file);
    const js = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const module = {exports:{}};
    cache.set(file, module);
    const localRequire = id => {
      if (!id.startsWith('.')) return require(id);
      const base = path.resolve(path.dirname(file), id);
      for (const p of [base+'.ts', base+'.tsx', path.join(base,'index.ts')]) {
        try {read(p); return load(p);} catch(e) {if (e.code !== 'ENOENT' && e.status === undefined) throw e;}
      }
      throw new Error('Cannot resolve '+id+' from '+file);
    };
    new Function('require','module','exports',js)(localRequire,module,module.exports);
    return module.exports;
  };
  return name => load(path.resolve(root, name));
}
