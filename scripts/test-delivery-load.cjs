const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('typescript');
const moduleObject={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/delivery-quote-types.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:moduleObject.exports,module:moduleObject});
const {summarizeLoad,basketKey}=moduleObject.exports;
let result=summarizeLoad([{quantity:12,product:{weight_kg:1.2,volume_litres:1.5,package_size:'compact'}}]);assert.ok(Math.abs(result.weight-14.4)<.0001);assert.equal(result.volume,18);assert.equal(result.complete,true);
result=summarizeLoad([{quantity:1,product:{weight_kg:2,package_size:'bag'}},{quantity:4,product:{weight_kg:3,volume_litres:2,package_size:'compact',fragile:true}}]);assert.equal(result.weight,null);assert.equal(result.volume,null);assert.equal(result.fragile,true);
result=summarizeLoad([{quantity:2,product:{weight_kg:10,volume_litres:30,package_size:'bulky',two_person_lift:true}}]);assert.equal(result.lift,true);assert.equal(result.weight,20);assert.throws(()=>summarizeLoad([{quantity:0,product:{}}]));assert.equal(basketKey([{id:'b',qty:2},{id:'a',qty:3}]),basketKey([{id:'a',qty:3},{id:'b',qty:2}]));
console.log('PASS: basket quantities, heavy multi-unit loads, missing-data manual assessment, handling flags and canonical baskets.');
