import test from 'node:test';
import assert from 'node:assert/strict';
import {groupPositions} from '../../src/ui/group-positions.js';
import {positions} from '../../src/ui/pages/positions.js';
import {positionDetails,positionLotDetails} from '../../src/ui/valuation-details.js';
const lot=(id,qty,price,extra={})=>({id,accountId:'a',code:'2313',creditType:'cash',direction:'long',qty,initialQty:'5000',price,marketPrice:'200',priceDate:'2026-11-19',marketValue:String(Number(qty)*200),unrealized:'10',grossUnrealized:'20',entryFee:'2',entryTax:'0',entryRebate:'1',exitFee:'3',exitTax:'5',estimatedExitRebate:'1',...extra});
test('remaining shares weight the cost, and displayed fees and PnL retain their exact totals',()=>{
 const input=[lot('x','1000','100'),lot('y','2000','200')],before=JSON.stringify(input);
 const [g]=groupPositions(input);
 assert.equal(g.qty,'3000');assert.ok(Math.abs(Number(g.price)-166.66666666666666)<1e-10);
 assert.equal(g.marketValue,'600000');assert.equal(g.unrealized,'20');assert.equal(g.entryFee,'4');assert.equal(g.exitTax,'10');
 assert.deepEqual(g.members.map(p=>p.id),['x','y']);assert.equal(JSON.stringify(input),before);
});
test('cash, margin, short, other tickers and accounts remain separate',()=>{
 const ps=[lot('c','1000','100'),lot('m','1000','100',{creditType:'margin'}),lot('s','1000','100',{creditType:'short',direction:'short'}),lot('b','1000','100',{accountId:'b'}),lot('t','1000','100',{code:'1303'})];
 assert.equal(groupPositions(ps).length,5);assert.deepEqual(groupPositions([]),[]);
});
test('an unavailable component never becomes a misleading partial PnL total',()=>{
 const [g]=groupPositions([lot('x','1000','100'),lot('y','1000','100',{unrealized:null,exitFee:null,entryFeeEstimated:true})]);
 assert.equal(g.unrealized,null);assert.equal(g.exitFee,null);assert.equal(g.entryFeeEstimated,true);
});
test('the holding table renders the combined row and retains each original batch edit target',()=>{
 const ps=[lot('x','1000','100',{opening:true}),lot('y','2000','200',{opening:true}),lot('m','1000','150',{creditType:'margin'})];
 const html=positions({latest:{positions:ps},book:{accounts:[{id:'a',name:'測試帳戶'}],trades:[]},account:'all',securityName:()=> '華通'});
 const holdingTable=html.slice(html.indexOf('<tbody>'),html.indexOf('</tbody>'));
 assert.equal((holdingTable.match(/<tr>/g)??[]).length,2);assert.match(holdingTable,/166\.67/);assert.match(holdingTable,/3,000/);assert.match(holdingTable,/融資/);assert.match(holdingTable,/查看批次/);
 const group=groupPositions(ps)[0],detail=positionDetails(group)+positionLotDetails(group);
 assert.match(detail,/20\.00/);assert.match(detail,/data-action="edit-opening" data-id="x"/);assert.match(detail,/data-action="edit-opening" data-id="y"/);
});
