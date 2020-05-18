'use strict';

const { parse } = require('acorn');
const estraverse = require('estraverse');
const espurify = require('espurify');
const assert = require('assert').strict;
const code = `
  function tenTimes (cb) {
    for (var i = 0; i < 10; i += 1) {
      cb();
    }
    for (var i = 0; i < 10; i += 1) {
      cb();
    }
  }
`;

function visitor (when, logs) {
  return (currentNode, parentNode) => {
    switch (currentNode.type) {
      case 'ForStatement':
      case 'CallExpression':
      case 'FunctionDeclaration':
        logs.push(when + ' ' + currentNode.type);
        break;
    }
  };
}

describe('estraverse learning', () => {
  describe('visitor return value', () => {
    it('estraverse.VisitorOption.Skip on enter', () => {
      const logs = [];
      estraverse.traverse(parse(code), {
        enter: (currentNode, parentNode) => {
          switch (currentNode.type) {
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
        'leaving ForStatement', // leave method is called with beginning-of-skip node
        'going to skip ForStatement',
        'leaving ForStatement', // leave method is called with beginning-of-skip node
        'leaving FunctionDeclaration'
      ]);
    });
    it('estraverse.VisitorOption.Skip on leave (just useless)', () => {
      const logs = [];
      estraverse.traverse(parse(code), {
        enter: visitor('entering', logs),
        leave: (currentNode, parentNode) => {
          switch (currentNode.type) {
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
    it('estraverse.VisitorOption.Break on enter', () => {
      const logs = [];
      estraverse.traverse(parse(code), {
        enter: (currentNode, parentNode) => {
          switch (currentNode.type) {
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
    it('estraverse.VisitorOption.Break on leave', () => {
      const logs = [];
      estraverse.traverse(parse(code), {
        enter: visitor('entering', logs),
        leave: (currentNode, parentNode) => {
          switch (currentNode.type) {
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

  describe('Controller API', () => {
    it('Controller#skip on enter', () => {
      const logs = [];
      estraverse.traverse(parse(code), {
        enter: function (currentNode, parentNode) {
          switch (currentNode.type) {
            case 'ForStatement':
              logs.push('going to skip ForStatement');
              this.skip();
              break;
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
        'leaving ForStatement', // leave method is called with beginning-of-skip node
        'going to skip ForStatement',
        'leaving ForStatement', // leave method is called with beginning-of-skip node
        'leaving FunctionDeclaration'
      ]);
    });
    it('Controller#break on leave', () => {
      const logs = [];
      estraverse.traverse(parse(code), {
        enter: visitor('entering', logs),
        leave: function (currentNode, parentNode) {
          switch (currentNode.type) {
            case 'ForStatement':
              logs.push('going to break from ForStatement on leave');
              this.break();
              break;
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

  describe('estraverse#replace', () => {
    const expectedCode = `
      function tenTimes (cb) {
        for (var i = 0; i < 10; i += 1) {
          wrap(cb());
        }
        for (var i = 0; i < 10; i += 1) {
          wrap(cb());
        }
      }
`;

    describe('wrap CallExpression on leave', () => {
      let origAst, inputAst, resultAst, logs;
      beforeEach(() => {
        logs = [];
        origAst = parse(code);
        inputAst = espurify(origAst);
        resultAst = estraverse.replace(inputAst, {
          enter: visitor('entering', logs),
          leave: (currentNode, parentNode) => {
            switch (currentNode.type) {
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
                    arguments: [currentNode]
                  };
                }
            }
            return undefined;
          }
        });
      });
      it('does not visit created node', () => {
        assert.deepEqual(logs, [
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
      it('returns modified tree', () => {
        assert.notDeepEqual(espurify(origAst), espurify(resultAst));
        assert.deepEqual(espurify(resultAst), espurify(parse(expectedCode)));
      });
      it('passed tree is modified destructively', () => {
        assert(inputAst === resultAst);
        assert.notDeepEqual(espurify(origAst), espurify(inputAst));
      });
    });
  });
});
