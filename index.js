'use strict';

var estraverse = require('estraverse');
var slice = Array.prototype.slice;


function SubVisitor () {
    this.skipStartNode = null;
    this.broken = false;
}
SubVisitor.prototype.isBroken = function () {
    return !!this.broken;
};
SubVisitor.prototype.markBroken = function () {
    return this.broken = true;
};
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
            var orig = this;
            enters.forEach(function (subVisitor) {
                var controller = Object.create(orig);
                if (subVisitor.isBroken()) {
                    return;
                }
                if (subVisitor.isSkipping(controller)) {
                    return;
                }
                controller.notify = function notify (flag) {
                    switch (flag) {
                    case estraverse.VisitorOption.Skip:
                        subVisitor.startSkipping(controller);
                        return;
                    case estraverse.VisitorOption.Break:
                        subVisitor.markBroken();
                        return;
                    default:
                        orig.notify.call(orig, flag);
                    }
                };
                var ret = subVisitor.enter.call(controller, currentNode, parentNode);
                switch (ret) {
                case estraverse.VisitorOption.Skip:
                    subVisitor.startSkipping(controller);
                    break;
                case estraverse.VisitorOption.Break:
                    subVisitor.markBroken();
                    break;
                }
            });
        },
        leave: function (currentNode, parentNode) {
            var controller = this;
            var replacements = [];
            leaves.forEach(function (subVisitor) {
                if (subVisitor.isBroken(controller)) {
                    return;
                }
                if (subVisitor.isSkipping(controller)) {
                    return;
                }
                subVisitor.beforeLeave(controller);
                var ret = subVisitor.leave.call(controller, currentNode, parentNode);
                switch (ret) {
                case estraverse.VisitorOption.Skip:
                    // subVisitor.startSkipping(controller);  // meaningless
                    return;
                case estraverse.VisitorOption.Break:
                    subVisitor.markBroken();
                    return;
                }
                if (typeof ret === 'object' && ret !== null && typeof ret.type === 'string') {
                    replacements.push(ret);
                }
            });
            if (replacements.length === 1) {
                return replacements[0];
            }
            return undefined;
        }
    };
};

module.exports = mergeVisitors;
