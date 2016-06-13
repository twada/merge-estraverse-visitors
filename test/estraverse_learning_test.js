'use strict';

var acorn = require('acorn');
var estraverse = require('estraverse');
var assert = require('assert');

var code = [
    'function tenTimes (cb) {',
    '    for (var i = 0; i < 10; i += 1) {',
    '        cb();',
    '    }',
    '}'
].join('\n');

describe('estraverse learning', function () {

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
            leave: function (currentNode, parentNode) {
                switch(currentNode.type) {
                case 'ForStatement':
                case 'CallExpression':
                case 'FunctionDeclaration':
                    logs.push('leaving ' + currentNode.type);
                    break;
                }
            }
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
            leave: function (currentNode, parentNode) {
                switch(currentNode.type) {
                case 'ForStatement':
                case 'CallExpression':
                case 'FunctionDeclaration':
                    logs.push('leaving ' + currentNode.type);
                    break;
                }
            }
        });
        assert.deepEqual(logs, [
            'entering FunctionDeclaration',
            'entering ForStatement'
        ]);
    });
});
