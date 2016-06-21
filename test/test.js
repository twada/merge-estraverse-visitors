'use strict';

delete require.cache[require.resolve('..')];
var mergeVisitors = require('..');
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

function visitor (name, when, logs) {
    return function (currentNode, parentNode) {
        switch(currentNode.type) {
        case 'ForStatement':
        case 'CallExpression':
        case 'FunctionDeclaration':
            logs.push(name + ': ' + when + ' ' + currentNode.type);
            break;
        }
    };
}

describe('merge multiple visitors', function () {
    it('visitors in order', function () {
        var logs = [];
        estraverse.traverse(acorn.parse(code), mergeVisitors(
            {
                enter: visitor('v1', 'entering', logs),
                leave: visitor('v1', 'leaving', logs)
            },
            {
                enter: visitor('v2', 'entering', logs),
                leave: visitor('v2', 'leaving', logs)
            }
        ));
        assert.deepEqual(logs, [
            'v1: entering FunctionDeclaration',
            'v2: entering FunctionDeclaration',
            'v1: entering ForStatement',
            'v2: entering ForStatement',
            'v1: entering CallExpression',
            'v2: entering CallExpression',
            'v2: leaving CallExpression',
            'v1: leaving CallExpression',
            'v2: leaving ForStatement',
            'v1: leaving ForStatement',
            'v2: leaving FunctionDeclaration',
            'v1: leaving FunctionDeclaration'
        ]);
    });
    it('enter only visitor, leave only visitor', function () {
        var logs = [];
        estraverse.traverse(acorn.parse(code), mergeVisitors(
            {
                enter: visitor('v1', 'entering', logs)
            },
            {
                leave: visitor('v2', 'leaving', logs)
            }
        ));
        assert.deepEqual(logs, [
            'v1: entering FunctionDeclaration',
            'v1: entering ForStatement',
            'v1: entering CallExpression',
            'v2: leaving CallExpression',
            'v2: leaving ForStatement',
            'v2: leaving FunctionDeclaration'
        ]);
    });
});

describe('interrupt skip and break', function () {
    it('skip per visitor', function () {
        var logs = [];
        estraverse.traverse(acorn.parse(code), mergeVisitors(
            {
                enter: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                        logs.push('v1: going to skip ' + currentNode.type);
                        return estraverse.VisitorOption.Skip;
                    case 'CallExpression':
                    case 'FunctionDeclaration':
                        logs.push('v1: entering ' + currentNode.type);
                        break;
                    }
                    return undefined;
                },
                leave: visitor('v1', 'leaving', logs)
            },
            {
                enter: visitor('v2', 'entering', logs),
                leave: visitor('v2', 'leaving', logs)
            }
        ));
        assert.deepEqual(logs, [
            'v1: entering FunctionDeclaration',
            'v2: entering FunctionDeclaration',
            'v1: going to skip ForStatement',
            'v2: entering ForStatement',
            'v2: entering CallExpression',
            'v2: leaving CallExpression',
            'v2: leaving ForStatement',
            'v1: leaving ForStatement',
            'v2: leaving FunctionDeclaration',
            'v1: leaving FunctionDeclaration'
        ]);
    });
    it('break per visitor', function () {
        var logs = [];
        estraverse.traverse(acorn.parse(code), mergeVisitors(
            {
                enter: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                        logs.push('v1: going to break from ' + currentNode.type);
                        return estraverse.VisitorOption.Break;
                    case 'CallExpression':
                    case 'FunctionDeclaration':
                        logs.push('v1: entering ' + currentNode.type);
                        break;
                    }
                    return undefined;
                },
                leave: visitor('v1', 'leaving', logs)
            },
            {
                enter: visitor('v2', 'entering', logs),
                leave: visitor('v2', 'leaving', logs)
            }
        ));
        assert.deepEqual(logs, [
            'v1: entering FunctionDeclaration',
            'v2: entering FunctionDeclaration',
            'v1: going to break from ForStatement',
            'v2: entering ForStatement',
            'v2: entering CallExpression',
            'v2: leaving CallExpression',
            'v2: leaving ForStatement',
            'v2: leaving FunctionDeclaration'
        ]);
    });
    it('break one visitor on leave', function () {
        var logs = [];
        estraverse.traverse(acorn.parse(code), mergeVisitors(
            {
                enter: visitor('v1', 'entering', logs),
                leave: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                        logs.push('v1: going to break from ' + currentNode.type + ' on leave');
                        return estraverse.VisitorOption.Break;
                    case 'CallExpression':
                    case 'FunctionDeclaration':
                        logs.push('v1: leaving ' + currentNode.type);
                        break;
                    }
                    return undefined;
                }
            },
            {
                enter: visitor('v2', 'entering', logs),
                leave: visitor('v2', 'leaving', logs)
            }
        ));
        assert.deepEqual(logs, [
            'v1: entering FunctionDeclaration',
            'v2: entering FunctionDeclaration',
            'v1: entering ForStatement',
            'v2: entering ForStatement',
            'v1: entering CallExpression',
            'v2: entering CallExpression',
            'v2: leaving CallExpression',
            'v1: leaving CallExpression',
            'v2: leaving ForStatement',
            'v1: going to break from ForStatement on leave',
            'v2: leaving FunctionDeclaration'
        ]);
    });
});

describe('on estraverse.replace', function () {
    var expectedCode = [
        'function tenTimes (cb) {',
        '    for (var i = 0; i < 10; i += 1) {',
        '        wrap(cb());',
        '    }',
        '}'
    ].join('\n');

    it('return replaced node from merged visitor', function () {
        var logs = [];
        var originalAst = espurify(acorn.parse(code));
        var actualAst = estraverse.replace(espurify(originalAst), mergeVisitors(
            {
                enter: visitor('v1', 'entering', logs),
                leave: visitor('v1', 'leaving', logs)
            },
            {
                enter: visitor('v2', 'entering', logs),
                leave: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                    case 'FunctionDeclaration':
                        logs.push('v2: leaving ' + currentNode.type);
                        break;
                    case 'CallExpression':
                        logs.push('v2: leaving ' + currentNode.type);
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
            }
        ));

        assert.deepEqual(logs, [
            'v1: entering FunctionDeclaration',
            'v2: entering FunctionDeclaration',
            'v1: entering ForStatement',
            'v2: entering ForStatement',
            'v1: entering CallExpression',
            'v2: entering CallExpression',
            'v2: leaving CallExpression',
            'v1: leaving CallExpression',
            'v2: leaving ForStatement',
            'v1: leaving ForStatement',
            'v2: leaving FunctionDeclaration',
            'v1: leaving FunctionDeclaration'
        ]);

        assert.deepEqual(actualAst, espurify(acorn.parse(expectedCode)));
    });

    it('mixture of skipping visitor and replacing visitor', function () {
        var logs = [];
        var originalAst = espurify(acorn.parse(code));
        var actualAst = estraverse.replace(espurify(originalAst), mergeVisitors(
            {
                enter: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                        logs.push('v1: going to skip ' + currentNode.type);
                        return estraverse.VisitorOption.Skip;
                    case 'CallExpression':
                    case 'FunctionDeclaration':
                        logs.push('v1: entering ' + currentNode.type);
                        break;
                    }
                    return undefined;
                },
                leave: visitor('v1', 'leaving', logs)
            },
            {
                enter: visitor('v2', 'entering', logs),
                leave: function (currentNode, parentNode) {
                    switch(currentNode.type) {
                    case 'ForStatement':
                    case 'FunctionDeclaration':
                        logs.push('v2: leaving ' + currentNode.type);
                        break;
                    case 'CallExpression':
                        logs.push('v2: leaving ' + currentNode.type);
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
            }
        ));

        assert.deepEqual(logs, [
            'v1: entering FunctionDeclaration',
            'v2: entering FunctionDeclaration',
            'v1: going to skip ForStatement',
            'v2: entering ForStatement',
            'v2: entering CallExpression',
            'v2: leaving CallExpression',
            'v2: leaving ForStatement',
            'v1: leaving ForStatement',
            'v2: leaving FunctionDeclaration',
            'v1: leaving FunctionDeclaration'
        ]);

        assert.deepEqual(actualAst, espurify(acorn.parse(expectedCode)));
    });
});
