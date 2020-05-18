/**
 * merge-estraverse-visitors
 *   merge multiple estraverse visitors into one
 *
 * https://github.com/twada/merge-estraverse-visitors
 *
 * Copyright (c) 2016-2020 Takuto Wada
 * Licensed under the MIT license.
 *   https://twada.mit-license.org/2016-2020
 */
'use strict';

const { VisitorOption } = require('estraverse');

function noop () {
}

class SubVisitor {
  constructor ({ enter, leave }) {
    this.enter = (typeof enter === 'function') ? enter : noop;
    this.leave = (typeof leave === 'function') ? leave : noop;
    this.skipStartNode = null;
    this.broken = false;
  }

  subEnter (controller, currentNode, parentNode) {
    return this.enter.call(controller, currentNode, parentNode);
  }

  subLeave (controller, currentNode, parentNode) {
    return this.leave.call(controller, currentNode, parentNode);
  }

  isBroken () {
    return !!this.broken;
  }

  markBroken () {
    this.broken = true;
  }

  isSkipping (controller) {
    return this.skipStartNode && (this.skipStartNode !== controller.current());
  }

  startSkipping (controller) {
    this.skipStartNode = controller.current();
  }

  finishSkippingIfLeavingFrom (controller) {
    if (this.skipStartNode === controller.current()) {
      this.skipStartNode = null;
    }
  }
}

function createSubVisitors (visitors) {
  const enters = [];
  const leaves = [];
  for (const v of visitors) {
    const subVisitor = new SubVisitor({ enter: v.enter, leave: v.leave });
    enters.push(subVisitor);
    leaves.unshift(subVisitor);
  }
  return {
    enters,
    leaves
  };
}

module.exports = function mergeVisitors (visitors) {
  const subVisitors = createSubVisitors(visitors);
  return {
    enter: function (currentNode, parentNode) {
      const orig = this;
      for (const subVisitor of subVisitors.enters) {
        if (subVisitor.isBroken()) {
          continue;
        }
        if (subVisitor.isSkipping(orig)) {
          continue;
        }
        const controller = Object.create(orig);
        controller.notify = (flag) => {
          switch (flag) {
            case VisitorOption.Skip:
              subVisitor.startSkipping(controller);
              return;
            case VisitorOption.Break:
              subVisitor.markBroken();
              return;
            default:
              orig.notify(flag);
          }
        };
        const flag = subVisitor.subEnter(controller, currentNode, parentNode);
        switch (flag) {
          case VisitorOption.Skip:
            subVisitor.startSkipping(controller);
            break;
          case VisitorOption.Break:
            subVisitor.markBroken();
            break;
        }
      }
    },
    leave: function (currentNode, parentNode) {
      const orig = this;
      const replacements = [];
      for (const subVisitor of subVisitors.leaves) {
        if (subVisitor.isBroken()) {
          continue;
        }
        if (subVisitor.isSkipping(orig)) {
          continue;
        }
        const controller = Object.create(orig);
        subVisitor.finishSkippingIfLeavingFrom(controller);
        controller.notify = (flag) => {
          switch (flag) {
            case VisitorOption.Skip:
              // subVisitor.startSkipping(controller);  // meaningless
              return;
            case VisitorOption.Break:
              subVisitor.markBroken();
              return;
            default:
              orig.notify(flag);
          }
        };
        const ret = subVisitor.subLeave(controller, currentNode, parentNode);
        switch (ret) {
          case VisitorOption.Skip:
            // subVisitor.startSkipping(controller);  // meaningless
            continue;
          case VisitorOption.Break:
            subVisitor.markBroken();
            continue;
        }
        if (typeof ret === 'object' && ret !== null && typeof ret.type === 'string') {
          // Node replacement
          replacements.push(ret);
        }
      }
      if (replacements.length === 1) {
        return replacements[0];
      }
      return undefined;
    }
  };
};
