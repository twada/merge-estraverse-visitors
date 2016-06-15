'use strict';

var acorn = require('acorn');
var estraverse = require('estraverse');
var espurify = require('espurify');
var assert = require('assert');

var code = [
    'function tenTimes (cb) {',
    '    for (var i = 0; i < 10; i += 1) {',
    '        cb();',
    '    }',
    '}'
].join('\n');

function visitor (when, logs) {
    return function (currentNode, parentNode) {
        switch(currentNode.type) {
        case 'ForStatement':
        case 'CallExpression':
        case 'FunctionDeclaration':
            logs.push(when + ' ' + currentNode.type);
            break;
        }
    };
}

describe('estraverse learning', function () {

    describe('visitor return value', function () {
        it('estraverse.VisitorOption.Skip', function () {
            var logs = [];
            estraverse.traverse(acorn.parse(code), {
                enter: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                        logs.push('going to skip ForStatement');
                        return estraverse.VisitorOption.Skip;
                    case 'CallExpression':
                    case 'FunctionDeclaration':
                        logs.push('entering ' + currentNode.type);
                        break;
                    }
                    return undefined;
                },
                leave: visitor('leaving', logs)
            });
            assert.deepEqual(logs, [
                'entering FunctionDeclaration',
                'going to skip ForStatement',
                'leaving ForStatement',   // leave method is called with beginning-of-skip node
                'leaving FunctionDeclaration'
            ]);
        });
        it('estraverse.VisitorOption.Break', function () {
            var logs = [];
            estraverse.traverse(acorn.parse(code), {
                enter: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                        logs.push('entering ForStatement');
                        return estraverse.VisitorOption.Break;
                    case 'CallExpression':
                    case 'FunctionDeclaration':
                        logs.push('entering ' + currentNode.type);
                        break;
                    }
                    return undefined;
                },
                leave: visitor('leaving', logs)
            });
            assert.deepEqual(logs, [
                'entering FunctionDeclaration',
                'entering ForStatement'
            ]);
        });
    });


    describe('estraverse#replace', function () {

        describe('wrap CallExpression on leave', function () {
            beforeEach(function () {
                var logs = [];
                this.origAst = acorn.parse(code);
                this.inputAst = espurify(this.origAst);
                this.resultAst = estraverse.replace(this.inputAst, {
                    enter: visitor('entering', logs),
                    leave: function (currentNode, parentNode) {
                        switch(currentNode.type) {
                        case 'ForStatement':
                        case 'FunctionDeclaration':
                            logs.push('leaving ' + currentNode.type);
                            break;
                        case 'CallExpression':
                            logs.push('leaving ' + currentNode.type);
                            if (currentNode.callee.name === 'cb') {
                                return {
                                    type: 'CallExpression',
                                    callee: {
                                        type: 'Identifier',
                                        name: 'wrap'
                                    },
                                    arguments: [ currentNode ]
                                };
                            }
                        }
                        return undefined;
                    }
                });
                this.logs = logs;
            });
            it('does not visit created node', function () {
                assert.deepEqual(this.logs, [
                    'entering FunctionDeclaration',
                    'entering ForStatement',
                    'entering CallExpression',
                    'leaving CallExpression',
                    'leaving ForStatement',
                    'leaving FunctionDeclaration'
                ]);
            });
            it('returns modified tree', function () {
                assert.notDeepEqual(espurify(this.origAst), espurify(this.resultAst));
            });
            it('passed tree is modified destructively', function () {
                assert(this.inputAst === this.resultAst);
                assert.notDeepEqual(espurify(this.origAst), espurify(this.inputAst));
            });
        });

    });

});
