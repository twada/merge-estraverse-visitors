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
        it('estraverse.VisitorOption.Skip on enter', function () {
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
                'going to skip ForStatement',
                'leaving ForStatement',   // leave method is called with beginning-of-skip node
                'leaving FunctionDeclaration'
            ]);
        });
        it('estraverse.VisitorOption.Skip on leave (just useless)', function () {
            var logs = [];
            estraverse.traverse(acorn.parse(code), {
                enter: visitor('entering', logs),
                leave: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                        logs.push('going to skip ForStatement on leave');
                        return estraverse.VisitorOption.Skip;
                    case 'CallExpression':
                    case 'FunctionDeclaration':
                        logs.push('leaving ' + currentNode.type);
                        break;
                    }
                    return undefined;
                }
            });
            assert.deepEqual(logs, [
                'entering FunctionDeclaration',
                'entering ForStatement',
                'entering CallExpression',
                'leaving CallExpression',
                'going to skip ForStatement on leave',
                'entering ForStatement',
                'entering CallExpression',
                'leaving CallExpression',
                'going to skip ForStatement on leave',
                'leaving FunctionDeclaration'
            ]);
        });
        it('estraverse.VisitorOption.Break on enter', function () {
            var logs = [];
            estraverse.traverse(acorn.parse(code), {
                enter: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                        logs.push('going to break from ForStatement');
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
                'going to break from ForStatement'
            ]);
        });
        it('estraverse.VisitorOption.Break on leave', function () {
            var logs = [];
            estraverse.traverse(acorn.parse(code), {
                enter: visitor('entering', logs),
                leave: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                        logs.push('going to break from ForStatement on leave');
                        return estraverse.VisitorOption.Break;
                    case 'CallExpression':
                    case 'FunctionDeclaration':
                        logs.push('leaving ' + currentNode.type);
                        break;
                    }
                    return undefined;
                }
            });
            assert.deepEqual(logs, [
                'entering FunctionDeclaration',
                'entering ForStatement',
                'entering CallExpression',
                'leaving CallExpression',
                'going to break from ForStatement on leave'
            ]);
        });
    });


    describe('estraverse#replace', function () {
        var expectedCode = [
            'function tenTimes (cb) {',
            '    for (var i = 0; i < 10; i += 1) {',
            '        wrap(cb());',
            '    }',
            '    for (var i = 0; i < 10; i += 1) {',
            '        wrap(cb());',
            '    }',
            '}'
        ].join('\n');

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
                    'entering ForStatement',
                    'entering CallExpression',
                    'leaving CallExpression',
                    'leaving ForStatement',
                    'leaving FunctionDeclaration'
                ]);
            });
            it('returns modified tree', function () {
                assert.notDeepEqual(espurify(this.origAst), espurify(this.resultAst));
                assert.deepEqual(espurify(this.resultAst), espurify(acorn.parse(expectedCode)));
            });
            it('passed tree is modified destructively', function () {
                assert(this.inputAst === this.resultAst);
                assert.notDeepEqual(espurify(this.origAst), espurify(this.inputAst));
            });
        });

    });

});
