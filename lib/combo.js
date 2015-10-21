/*
 * Copyright (c) 2015 xsbchen
 * Licensed under the MIT license.
 */

'use strict';

var extend = require('extend');
var url = require('url');

var templates = {
    script: '<script $attributes$ src="$src$"></script>',
    link: '<link $attributes$ href="$src$"/>'
};

/**
 * 模板解释
 * @param {String} tmpl 模板字符串
 * @param {Object} paramObj 数据
 * @return {String} 返回解释后的字符串
 */
function parseTmpl(tmpl, paramObj) {
    paramObj = paramObj || paramObj;

    if (typeof tmpl === 'string') {
        return tmpl.replace(/\$([_a-zA-Z0-9]*)\$/g, function (m, n) {
            return typeof paramObj[n] === 'undefined' ? '' : paramObj[n];
        });
    } else {
        return tmpl;
    }
}

/**
 * 解释属性字符串
 * @param {String} attrStr 属性字符串
 * @returns {Object} 属性对象
 */
function parseAttributes(attrStr) {
    var reAttributes = /([^=<>\"\'\s]+)\s*(?:=\s*["']?([^"']*)["']?)?/g;
    var result = {};
    var match;

    if (attrStr) {
        while(match = reAttributes.exec(attrStr)) {
            result[match[1]] = match[2] || true;
        }
    }

    return result;
}

/**
 * 获取匹配指定正则表达式的TAG列表
 * @param {String} rawHtml 待匹配的HTML源
 * @param {Regexp} reTag 指定的正则表达式
 * @returns {Array} 匹配的TAG列表
 */
function getTags(rawHtml, reTag) {
    var result = [];
    var match, attributes;

    while(match = reTag.exec(rawHtml)) {
        attributes = parseAttributes(match[2] || '');

        result.push({name: match[1], attributes: attributes, raw: match[0]});
    }

    return result;
}

/**
 * 分组
 * @param {Array} tags TAG列表
 * @param {String} key
 * @returns {Object}
 */
function groupTags(tags, key) {
  var groupBy = 'data-combo';
    return tags.reduce(function(previous, current) {
        var combineName = current.attributes[groupBy];
        var keyValue = current.attributes[key];

        if (!keyValue || !combineName) {
            return previous;
        }

        var group = previous[combineName];

        if (!group) {
            group = previous[combineName] = [];
        }

        delete current.attributes[groupBy];
        group.push(current);

        return previous;
    }, {});
};

/**
 * Combo Class
 * @param options
 * @constructor
 */
function Combo(options) {
  this.options = extend({
    basePath: '/c/=',
    separator: ',',
    selectors: {
      script: /<(script)([^>]*)>((?:.|\r\n)*?)<\/script>/g,
      link: /<(link)([^>]*?)\/?>/g
    }
  }, options);
}

/**
 * 生成合并TAG
 * @param type
 * @param files
 * @param attributes
 * @returns {String}
 * @private
 */
Combo.prototype._generateCombinedTag = function _generateCombinedTag(type, files, attributes) {
  var attrStr = [];
  var filesMaxIdx = files.length - 1;

  attributes = extend(true, {}, attributes);
  delete attributes.src;
  delete attributes.href;

  if (filesMaxIdx === 0) {
    files[0] = files[0].split('?')[0];
  } else {
    var combineUrlTmpl = '//$host$' + this.options.basePath  + '$pathname$';
    files = files.map(function(file, idx) {
      if (file.indexOf('//') === 0) {
        file = 'http:' + file;
      }

      var urlParts = url.parse(file);

      if (idx === 0) {
        return parseTmpl(combineUrlTmpl, urlParts);
      }

      return urlParts.pathname;
    });
  }

  for (var attrName in attributes) {
    attrStr.push(attrName + '="' + attributes[attrName] + '"');
  }

  return parseTmpl(templates[type], {src: encodeURI(files.join(this.options.separator)), attributes: attrStr.join(' ')});
};

/**
 * 处理TAGS
 * @param rawHtml
 * @param type
 * @param key
 * @returns {*}
 * @private
 */
Combo.prototype._processTags = function _processTags(rawHtml, type, key) {
  var allMatchTags = getTags(rawHtml, this.options.selectors[type]);
  var tagsGroup = groupTags(allMatchTags, key);
  var placeholder = '__$COMBINE$__';

  for (var combineName in tagsGroup) {
    var tags = tagsGroup[combineName];
    var tagsMaxIdx = tags.length - 1;
    var files = [];
    var attributes = {};

    tags.forEach(function(tag, idx) {
      files.push(tag.attributes[key]);
      extend(attributes, tag.attributes);

      rawHtml = rawHtml.replace(tag.raw, idx < tagsMaxIdx ? '' : placeholder);
    });

    rawHtml = rawHtml.replace(placeholder, this._generateCombinedTag(type, files, attributes));
  }

  return rawHtml;
};

/**
 * 处理内容
 * @param content
 * @returns {*}
 */
Combo.prototype.process = function combine(content) {
  content = this._processTags(content, 'script', 'src');
  content = this._processTags(content, 'link', 'href');
  return content;
};

module.exports = Combo;
