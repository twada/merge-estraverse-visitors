merge-estraverse-visitors
================================

Merge multiple visitors for estraverse


API
---------------------------------------

`var mergedVisitor = mergeVisitors(visitor1, visitor2, ...)`


INSTALL
---------------------------------------

```
npm install merge-estraverse-visitors
```


USAGE
---------------------------------------

For given code,

```js
function tenTimes (cb) {
    for (var i = 0; i < 10; i += 1) {
        cb();
    }
}
```

Merge multiple estraverse visitors into one then run against target AST.

```js
var ast = acorn.parse(code);
estraverse.traverse(ast, mergeVisitors(
    {
        enter: function (currentNode, parentNode) {
            switch(currentNode.type) {
            case 'ForStatement':
                console.log('v1: going to skip ' + currentNode.type);
                return estraverse.VisitorOption.Skip;
            case 'CallExpression':
            case 'FunctionDeclaration':
                console.log('v1: entering ' + currentNode.type);
                break;
            }
            return undefined;
        },
        leave: function (currentNode, parentNode) {
            switch(currentNode.type) {
            case 'ForStatement':
            case 'CallExpression':
            case 'FunctionDeclaration':
                console.log('v1: leaving ' + currentNode.type);
                break;
            }
        }
    },
    {
        enter: function (currentNode, parentNode) {
            switch(currentNode.type) {
            case 'ForStatement':
            case 'CallExpression':
            case 'FunctionDeclaration':
                console.log('v2: entering ' + currentNode.type);
                break;
            }
        },
        leave: function (currentNode, parentNode) {
            switch(currentNode.type) {
            case 'ForStatement':
            case 'CallExpression':
            case 'FunctionDeclaration':
                console.log('v2: leaving ' + currentNode.type);
                break;
            }
        }
    }
));
```

Results in:

```
v1: entering FunctionDeclaration
v2: entering FunctionDeclaration
v1: going to skip ForStatement
v2: entering ForStatement
v2: entering CallExpression
v2: leaving CallExpression
v2: leaving ForStatement
v1: leaving ForStatement
v2: leaving FunctionDeclaration
v1: leaving FunctionDeclaration
```


AUTHOR
---------------------------------------
* [Takuto Wada](https://github.com/twada)


LICENSE
---------------------------------------
Licensed under the [MIT](http://twada.mit-license.org/) license.
