//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import { consolidator } from '../Consolidator';
import { workspace } from 'vscode';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as myExtension from '../extension';

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", function () {

    const result = consolidator.consolidate([
        { start: 10, end: 15, workspace: 'a' }
        ,{ start: 13, end: 15, workspace: 'b' }
         ]);
    

    console.log(result);
    // test("Something 1", function () {
    //     assert.equal(-1, [1, 2, 3].indexOf(5));
    //     assert.equal(-1, [1, 2, 3].indexOf(0));
    // });
});