'use strict';

var estraverse = require('estraverse');
var slice = Array.prototype.slice;


function SubVisitor () {
    this.skipStartNode = null;
}
SubVisitor.prototype.isSkipping = function (controller) {
    return this.skipStartNode && (this.skipStartNode !== controller.current());
};
SubVisitor.prototype.startSkipping = function (controller) {
    this.skipStartNode = controller.current();
};
SubVisitor.prototype.beforeLeave = function (controller) {
    if (this.skipStartNode === controller.current()) {
        this.skipStartNode = null;
    }
};


function noop () {
}

var mergeVisitors = function () {
    var enters = [];
    var leaves = [];
    slice.apply(arguments).forEach(function (v) {
        var subVisitor = new SubVisitor();
        subVisitor.enter = (typeof v.enter === 'function') ? v.enter : noop;
        subVisitor.leave = (typeof v.leave === 'function') ? v.leave : noop;
        enters.push(subVisitor);
        leaves.unshift(subVisitor);
    });
    return {
        enter: function (currentNode, parentNode) {
            var controller = this;
            enters.forEach(function (subVisitor) {
                if (subVisitor.isSkipping(controller)) {
                    return;
                }
                var ret = subVisitor.enter.call(controller, currentNode, parentNode);
                switch (ret) {
                case estraverse.VisitorOption.Skip:
                    subVisitor.startSkipping(controller);
                }
            });
        },
        leave: function (currentNode, parentNode) {
            var controller = this;
            leaves.forEach(function (subVisitor) {
                if (subVisitor.isSkipping(controller)) {
                    return;
                }
                subVisitor.beforeLeave(controller);
                var ret = subVisitor.leave.call(controller, currentNode, parentNode);
                switch (ret) {
                case estraverse.VisitorOption.Skip:
                    // subVisitor.startSkipping(controller);  // meaningless
                }
            });
        }
    };
};

module.exports = mergeVisitors;
