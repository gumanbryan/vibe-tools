import test from 'node:test';import assert from 'node:assert/strict';
import {estimatedOpeningPrincipal} from '../../src/ui/opening-position.js';
test('opening principal uses acquisition cost, shares and configurable financing ratio',()=>{
 assert.equal(estimatedOpeningPrincipal('240.5','1000','60'),'144000');
 assert.equal(estimatedOpeningPrincipal('240.5','1000','50'),'120000');
 assert.equal(estimatedOpeningPrincipal('','1000','60'),'');
 assert.equal(estimatedOpeningPrincipal('240.5','1000','101'),'');
 assert.equal(estimatedOpeningPrincipal('240.5','1.5','60'),'');
});
