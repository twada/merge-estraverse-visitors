'use strict';

delete require.cache[require.resolve('..')];
const mergeVisitors = require('..');
const { parse } = require('acorn');
const estraverse = require('estraverse');
const espurify = require('espurify');
const assert = require('assert').strict;
const code = `
  function tenTimes (cb) {
    for (var i = 0; i < 10; i += 1) {
      cb();
    }
  }
`;

function visitor (name, when, logs) {
  return (currentNode, parentNode) => {
    switch (currentNode.type) {
      case 'ForStatement':
      case 'CallExpression':
      case 'FunctionDeclaration':
        logs.push(name + ': ' + when + ' ' + currentNode.type);
        break;
    }
  };
}

describe('merge multiple visitors', () => {
  it('visitors in order', () => {
    const logs = [];
    estraverse.traverse(parse(code), mergeVisitors([
      {
        enter: visitor('v1', 'entering', logs),
        leave: visitor('v1', 'leaving', logs)
      },
      {
        enter: visitor('v2', 'entering', logs),
        leave: visitor('v2', 'leaving', logs)
      }
    ]));
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
  it('enter only visitor, leave only visitor', () => {
    const logs = [];
    estraverse.traverse(parse(code), mergeVisitors([
      {
        enter: visitor('v1', 'entering', logs)
      },
      {
        leave: visitor('v2', 'leaving', logs)
      }
    ]));
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

describe('interrupt skip and break', () => {
  it('when one of visitors returns estraverse.VisitorOption.Skip on enter', () => {
    const logs = [];
    estraverse.traverse(parse(code), mergeVisitors([
      {
        enter: (currentNode, parentNode) => {
          switch (currentNode.type) {
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
    ]));
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
  it('when one of visitors calls Controller#skip on enter', () => {
    const logs = [];
    estraverse.traverse(parse(code), mergeVisitors([
      {
        enter: function (currentNode, parentNode) {
          switch (currentNode.type) {
            case 'ForStatement':
              logs.push('v1: going to skip ' + currentNode.type);
              this.skip();
              break;
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
    ]));
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
  it('when one of visitors returns estraverse.VisitorOption.Break on enter', () => {
    const logs = [];
    estraverse.traverse(parse(code), mergeVisitors([
      {
        enter: (currentNode, parentNode) => {
          switch (currentNode.type) {
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
    ]));
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
  it('when one of visitors calls Controller#break on enter', () => {
    const logs = [];
    estraverse.traverse(parse(code), mergeVisitors([
      {
        enter: function (currentNode, parentNode) {
          switch (currentNode.type) {
            case 'ForStatement':
              logs.push('v1: going to break from ' + currentNode.type);
              this.break();
              break;
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
    ]));
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
  it('when one of visitors returns estraverse.VisitorOption.Break on leave', () => {
    const logs = [];
    estraverse.traverse(parse(code), mergeVisitors([
      {
        enter: visitor('v1', 'entering', logs),
        leave: (currentNode, parentNode) => {
          switch (currentNode.type) {
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
    ]));
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
  it('when one of visitors calls Controller#break on leave', () => {
    const logs = [];
    estraverse.traverse(parse(code), mergeVisitors([
      {
        enter: visitor('v1', 'entering', logs),
        leave: function (currentNode, parentNode) {
          switch (currentNode.type) {
            case 'ForStatement':
              logs.push('v1: going to break from ' + currentNode.type + ' on leave');
              this.break();
              break;
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
    ]));
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

describe('on estraverse.replace', () => {
  const expectedCode = `
    function tenTimes (cb) {
      for (var i = 0; i < 10; i += 1) {
        wrap(cb());
      }
    }
`;

  it('return replaced node from merged visitor', () => {
    const logs = [];
    const originalAst = espurify(parse(code));
    const actualAst = estraverse.replace(espurify(originalAst), mergeVisitors([
      {
        enter: visitor('v1', 'entering', logs),
        leave: visitor('v1', 'leaving', logs)
      },
      {
        enter: visitor('v2', 'entering', logs),
        leave: (currentNode, parentNode) => {
          switch (currentNode.type) {
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
                  arguments: [currentNode]
                };
              }
          }
          return undefined;
        }
      }
    ]));

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

    assert.deepEqual(actualAst, espurify(parse(expectedCode)));
  });

  it('mixture of skipping visitor and replacing visitor', () => {
    const logs = [];
    const originalAst = espurify(parse(code));
    const actualAst = estraverse.replace(espurify(originalAst), mergeVisitors([
      {
        enter: (currentNode, parentNode) => {
          switch (currentNode.type) {
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
        leave: (currentNode, parentNode) => {
          switch (currentNode.type) {
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
                  arguments: [currentNode]
                };
              }
          }
          return undefined;
        }
      }
    ]));

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

    assert.deepEqual(actualAst, espurify(parse(expectedCode)));
  });
});
