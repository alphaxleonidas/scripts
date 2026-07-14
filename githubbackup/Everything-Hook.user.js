// ==UserScript==
// @name         Everything-Hook
// @namespace    https://gitee.com/HGJing/everthing-hook/
// @updateURL    https://github.com/alphaxleonidas/Scripts/raw/refs/heads/main/githubbackup/Everything-Hook.user.js
// @version      0.5.9056
// @include      *
// @description  it can hook everything
// @author       Leonidas
// @match        http://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==
 
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else {
		var a = factory();
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(typeof self !== 'undefined' ? self : this, function() {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {
 
"use strict";
 
/**
 * ---------------------------
 * Time: 2017/9/20 18:33.
 * Author: Cangshi
 * View: http://palerock.cn
 * ---------------------------
 */
 
 
const eUtils = __webpack_require__(1);
 
~(function (global, factory) {
 
    "use strict";
 
    if ( true && typeof module.exports === "object") {
        var results = factory.bind(global)(global, eUtils, true) || [];
        var HookJS = {};
        results.forEach(function (part) {
            HookJS[part.name] = part.module;
        });
        module.exports = HookJS;
    } else {
        factory.bind(global)(global, eUtils);
    }
 
}(typeof window !== "undefined" ? window : this, function (_global, utils, noGlobal) {
    /**
     * @namespace EHook
     * @author Cangshi
     * @constructor
     * @see {@link https://palerock.cn/projects/006HDUuOhBj}
     * @license Apache License 2.0
     */
    var EHook = function () {
        var _autoId = 1;
        var _hookedMap = {};
        var _hookedContextMap = {};
        this._getHookedMap = function () {
            return _hookedMap;
        };
        this._getHookedContextMap = function () {
            return _hookedContextMap;
        };
        this._getAutoStrId = function () {
            return '__auto__' + _autoId++;
        };
        this._getAutoId = function () {
            return _autoId++;
        };
    };
    EHook.prototype = {
        /**
         * Get the hijacking ID of an object; create it if it doesn't exist.
         * @param context
         * @return {*}
         * @private
         */
        _getHookedId: function (context) {
            var contextMap = this._getHookedContextMap();
            var hookedId = null;
            Object.keys(contextMap).forEach(key => {
                if (context === contextMap[key]) {
                    hookedId = key;
                }
            });
            if (hookedId == null) {
                hookedId = this._getAutoStrId();
                contextMap[hookedId] = context;
            }
            return hookedId;
        },
        /**
         * Retrieve a hijacking method mapping for an object; create one if it doesn't exist.
         * @param context
         * @return {*}
         * @private
         */
        _getHookedMethodMap: function (context) {
            var hookedId = this._getHookedId(context);
            var hookedMap = this._getHookedMap();
            var thisTask = hookedMap[hookedId];
            if (!utils.isExistObject(thisTask)) {
                thisTask = hookedMap[hookedId] = {};
            }
            return thisTask;
        },
        /**
         * Get the hook prototype task object for the corresponding method; if it doesn't exist, initialize one.
         * @param context
         * @param methodName
         * @private
         */
        _getHookedMethodTask: function (context, methodName) {
            var thisMethodMap = this._getHookedMethodMap(context);
            var thisMethod = thisMethodMap[methodName];
            if (!utils.isExistObject(thisMethod)) {
                thisMethod = thisMethodMap[methodName] = {
                    original: undefined,
                    replace: undefined,
                    task: {
                        before: [],
                        current: undefined,
                        after: []
                    }
                };
            }
            return thisMethod;
        },
        /**
         * Execute multiple methods and inject a method and parameter set.
         * @param context
         * @param methods
         * @param args
         * @return result 最后一次执行方法的有效返回值
         * @private
         */
        _invokeMethods: function (context, methods, args) {
            if (!utils.isArray(methods)) {
                return;
            }
            var result = null;
            utils.ergodicArrayObject(context, methods, function (_method) {
                if (!utils.isFunction(_method.method)) {
                    return;
                }
                var r = _method.method.apply(this, args);
                if (r != null) {
                    result = r;
                }
            });
            return result;
        },
        /**
         * Generate and replace hijacking methods
         * @param parent
         * @param context
         * @param methodName {string}
         * @private
         */
        _hook: function (parent, methodName, context) {
            if (context === undefined) {
                context = parent;
            }
            var method = parent[methodName];
            var methodTask = this._getHookedMethodTask(parent, methodName);
            if (!methodTask.original) {
                methodTask.original = method;
            }
            if (utils.isExistObject(methodTask.replace) && utils.isFunction(methodTask.replace.method)) {
                parent[methodName] = methodTask.replace.method(methodTask.original);
                return;
            }
            var invokeMethods = this._invokeMethods;
            // Assemble the hijacking function
            var builder = new utils.FunctionBuilder(function (v) {
                return {
                    result: undefined
                };
            });
            if (methodTask.task.before.length > 0) {
                builder.push(function (v) {
                    invokeMethods(context || v.this, methodTask.task.before, [methodTask.original, v.arguments]);
                });
            }
            if (utils.isExistObject(methodTask.task.current) && utils.isFunction(methodTask.task.current.method)) {
                builder.push(function (v) {
                    return {
                        result: methodTask.task.current.method.call(context || v.this, parent, methodTask.original, v.arguments)
                    }
                });
            } else {
                builder.push(function (v) {
                    return {
                        result: methodTask.original.apply(context || v.this, v.arguments)
                    }
                });
            }
            if (methodTask.task.after.length > 0) {
                builder.push(function (v) {
                    var args = [];
                    args.push(methodTask.original);
                    args.push(v.arguments);
                    args.push(v.result);
                    var r = invokeMethods(context || v.this, methodTask.task.after, args);
                    return {
                        result: (r != null ? r : v.result)
                    };
                });
            }
            builder.push(function (v) {
                return {
                    returnValue: v.result
                };
            });
            // var methodStr = '(function(){\n';
            // methodStr = methodStr + 'var result = undefined;\n';
            // if (methodTask.task.before.length > 0) {
            //     methodStr = methodStr + 'invokeMethods(context, methodTask.task.before,[methodTask.original, arguments]);\n';
            // }
            // if (utils.isExistObject(methodTask.task.current) && utils.isFunction(methodTask.task.current.method)) {
            //     methodStr = methodStr + 'result = methodTask.task.current.method.call(context, parent, methodTask.original, arguments);\n';
            // } else {
            //     methodStr = methodStr + 'result = methodTask.original.apply(context, arguments);\n';
            // }
            // if (methodTask.task.after.length > 0) {
            //     methodStr = methodStr + 'var args = [];args.push(methodTask.original);args.push(arguments);args.push(result);\n';
            //     methodStr = methodStr + 'var r = invokeMethods(context, methodTask.task.after, args);result = (r!=null?r:result);\n';
            // }
            // methodStr = methodStr + 'return result;\n})';
            // Binding hijacking function
            var resultFunc = builder.result();
            for (var proxyName in methodTask.original) {
                Object.defineProperty(resultFunc, proxyName, {
                    get: function () {
                        return methodTask.original[proxyName];
                    },
                    set: function (v) {
                        methodTask.original[proxyName] = v;
                    }
                })
            }
            resultFunc.prototype = methodTask.original.prototype;
            parent[methodName] = resultFunc;
        },
        /**
         * Hijack a method
         * @inner
         * @memberOf EHook
         * @param parent{Object} The object containing the specified method
         * @param methodName{String} Specify the name of the method
         * @param config{Object} Hijacked configuration object
         */
        hook: function (parent, methodName, config) {
            var hookedFailure = -1;
            // The context of calling the method
            var context = config.context !== undefined ? config.context : parent;
            if (parent[methodName] == null) {
                parent[methodName] = function () {
                }
            }
            if (!utils.isFunction(parent[methodName])) {
                return hookedFailure;
            }
            var methodTask = this._getHookedMethodTask(parent, methodName);
            var id = this._getAutoId();
            if (utils.isFunction(config.replace)) {
                methodTask.replace = {
                    id: id,
                    method: config.replace
                };
                hookedFailure = 0;
            }
            if (utils.isFunction(config.before)) {
                methodTask.task.before.push({
                    id: id,
                    method: config.before
                });
                hookedFailure = 0;
            }
            if (utils.isFunction(config.current)) {
                methodTask.task.current = {
                    id: id,
                    method: config.current
                };
                hookedFailure = 0;
            }
            if (utils.isFunction(config.after)) {
                methodTask.task.after.push({
                    id: id,
                    method: config.after
                });
                hookedFailure = 0;
            }
            if (hookedFailure === 0) {
                this._hook(parent, methodName, context);
                return id;
            } else {
                return hookedFailure;
            }
 
        },
        /**
         * Hijacking and replacing a method
         * @see Note: This method will override all previous hijacking operations performed by the specified hijacking method, cannot be reused, and cannot coexist with hookAfter, hookCurrent, and hookBefore. When used simultaneously, hookReplace takes precedence over other methods.
         * @inner
         * @memberOf EHook
         * @param parent{Object} The object containing the specified method
         * @param context{Object=} Context of callback method
         * @param methodName{String} Specify the name of the method
         * @param replace {function} The callback method, whose return value is the replacement method. Callback parameters and return value: [method: the original method, type: function; return: the content of the method to be replaced, type: function]
         * @return {number} The ID used in this hijacking
         */
        hookReplace: function (parent, methodName, replace, context) {
            return this.hook(parent, methodName, {
                replace: replace,
                context: context
            });
        },
        /**
         * Execute before the specified method
         * @inner
         * @memberOf EHook
         * @param parent{Object} The object containing the specified method
         * @param methodName{String} Specify the name of the method
         * @param before{function} Callback method, which is executed before the specified method runs. Callback parameters: [method: the specified original method; args: the parameters to be executed in the original method (changing the parameter values ​​here will affect the parameter values ​​of the subsequent specified method)]
         * @param context{Object=} Context of callback method
         * @returns {number} hijack id（Used to remove hijacking）
         */
        hookBefore: function (parent, methodName, before, context) {
            return this.hook(parent, methodName, {
                before: before,
                context: context
            });
        },
        /**
         * When a method is hijacked, it will not execute automatically; instead, the `current` method specified in the parameters will be executed.
         * @see Note: This method can only hijack the specified method once. If this method is used again, it will overwrite the previous hijacking. [It can coexist with hookBefore and hookAfter, and hookBefore and hookAfter can hijack the same specified method multiple times.]
         * @inner
         * @memberOf EHook
         * @param parent{Object} The object containing the specified method
         * @param methodName{String} Specify the name of the method
         * @param current{function} A callback method that executes when the specified method is invoked. Callback parameters and return value: [parent: the object containing the specified method, type: object; method: the original method, type: function; args: the parameters of the original method, type: array; return: the return value of the hijacked method, type: *]
         * @param context{Object=} Context of callback method
         * @returns {number} Hijacking ID (used to unhijack)
         */
        hookCurrent: function (parent, methodName, current, context) {
            return this.hook(parent, methodName, {
                current: current,
                context: context
            });
        },
        /**
         * Execute after the specified method
         * @inner
         * @memberOf EHook
         * @param parent{Object} The object containing the specified method
         * @param methodName{String} Specify the name of the method
         * @param after{function} Callback method, executed after the specified method runs. Callback parameters and return value: [ method: the original method, type: function; args: the parameters of the original method, type: array; result: the return value of the original method, type: *; return: the return value of the hijacked method, type: *]
         * @param context{Object=} Context of callback method
         * @returns {number} Hijacking ID (used to unhijack)
         */
        hookAfter: function (parent, methodName, after, context) {
            return this.hook(parent, methodName, {
                after: after,
                context: context
            });
        },
        hookClass: function (parent, className, replace, innerName, excludeProperties) {
            var _this = this;
            var originFunc = parent[className];
            if (!excludeProperties) {
                excludeProperties = [];
            }
            excludeProperties.push('prototype');
            excludeProperties.push('caller');
            excludeProperties.push('arguments');
            innerName = innerName || '_innerHook';
            var resFunc = function () {
                this[innerName] = new originFunc();
                replace.apply(this, arguments);
            };
            this.hookedToString(originFunc, resFunc);
            this.hookedToProperties(originFunc, resFunc, true, excludeProperties);
            var prototypeProperties = Object.getOwnPropertyNames(originFunc.prototype);
            var prototype = resFunc.prototype = {
                constructor: resFunc
            };
            prototypeProperties.forEach(function (name) {
                if (name === 'constructor') {
                    return;
                }
                var method = function () {
                    if (originFunc.prototype[name] && utils.isFunction(originFunc.prototype[name])) {
                        return originFunc.prototype[name].apply(this[innerName], arguments);
                    }
                    return undefined;
                };
                _this.hookedToString(originFunc.prototype[name], method);
                prototype[name] = method;
            });
            this.hookReplace(parent, className, function () {
                return resFunc;
            }, parent)
        },
        hookedToProperties: function (originObject, resultObject, isDefined, excludeProperties) {
            var objectProperties = Object.getOwnPropertyNames(originObject);
            objectProperties.forEach(function (property) {
                if (utils.contains(excludeProperties, property)) {
                    return;
                }
                if (!isDefined) {
                    resultObject[property] = originObject[property];
                } else {
                    Object.defineProperty(resultObject, property, {
                        configurable: false,
                        enumerable: false,
                        value: originObject[property],
                        writable: false
                    });
                }
            });
        },
        hookedToString: function (originObject, resultObject) {
            Object.defineProperties(resultObject, {
                toString: {
                    configurable: false,
                    enumerable: false,
                    value: originObject.toString.bind(originObject),
                    writable: false
                },
                toLocaleString: {
                    configurable: false,
                    enumerable: false,
                    value: originObject.toLocaleString.bind(originObject),
                    writable: false
                }
            })
        },
        /**
         * Hijacking global AJAX
         * @inner
         * @memberOf EHook
         * @param methods {object} Hijacking method
         * @return {*|number} hijacked ID
         */
        hookAjax: function (methods) {
            if (this.isHooked(_global, 'XMLHttpRequest')) {
                return;
            }
            var _this = this;
            var hookMethod = function (methodName) {
                if (utils.isFunction(methods[methodName])) {
                    // Hook the original method before executing the method.
                    _this.hookBefore(this.xhr, methodName, methods[methodName]);
                }
                // The return method calls the internal xhr
                return this.xhr[methodName].bind(this.xhr);
            };
            var getProperty = function (attr) {
                return function () {
                    return this.hasOwnProperty(attr + "_") ? this[attr + "_"] : this.xhr[attr];
                };
            };
            var setProperty = function (attr) {
                return function (f) {
                    var xhr = this.xhr;
                    var that = this;
                    if (attr.indexOf("on") !== 0) {
                        this[attr + "_"] = f;
                        return;
                    }
                    if (methods[attr]) {
                        xhr[attr] = function () {
                            f.apply(xhr, arguments);
                        };
                        // The on method is hijacked during set.
                        _this.hookBefore(xhr, attr, methods[attr]);
                        // console.log(1,attr);
                        // xhr[attr] = function () {
                        //     methods[attr](that) || f.apply(xhr, arguments);
                        // }
                    } else {
                        xhr[attr] = f;
                    }
                };
            };
            return this.hookReplace(_global, 'XMLHttpRequest', function (XMLHttpRequest) {
                var resFunc = function () {
                    this.xhr = new XMLHttpRequest();
                    for (var propertyName in this.xhr) {
                        var property = this.xhr[propertyName];
                        if (utils.isFunction(property)) {
                            // hook 原方法
                            this[propertyName] = hookMethod.bind(this)(propertyName);
                        } else {
                            Object.defineProperty(this, propertyName, {
                                get: getProperty(propertyName),
                                set: setProperty(propertyName)
                            });
                        }
                    }
                    // Define an external xhr that can be accessed internally.
                    this.xhr.xhr = this;
                };
                _this.hookedToProperties(XMLHttpRequest, resFunc, true);
                _this.hookedToString(XMLHttpRequest, resFunc);
                return resFunc
            });
        },
        /**
         * Hijacking global AJAX
         * @param methods {object} Hijacking method
         * @return {*|number} hijacked ID
         */
        hookAjaxV2: function (methods) {
            this.hookClass(window, 'XMLHttpRequest', function () {
 
            });
            utils.ergodicObject(this, methods, function (method) {
 
            });
        },
        /**
         * Unhijack
         * @inner
         * @memberOf EHook
         * @param context context
         * @param methodName method name
         * @param isDeeply {boolean=} Whether to perform a deep unblocking [default is false]
         * @param eqId {number=}  Unblock the specified ID [Optional]
         */
        unHook: function (context, methodName, isDeeply, eqId) {
            if (!context[methodName] || !utils.isFunction(context[methodName])) {
                return;
            }
            var methodTask = this._getHookedMethodTask(context, methodName);
            if (eqId) {
                if (this.unHookById(eqId)) {
                    return;
                }
            }
            if (!methodTask.original) {
                delete this._getHookedMethodMap(context)[methodName];
                return;
            }
            context[methodName] = methodTask.original;
            if (isDeeply) {
                delete this._getHookedMethodMap(context)[methodName];
            }
        },
        /**
         * Unhijacking via ID
         * @inner
         * @memberOf EHook
         * @param eqId
         * @returns {boolean}
         */
        unHookById: function (eqId) {
            var hasEq = false;
            if (eqId) {
                var hookedMap = this._getHookedMap();
                utils.ergodicObject(this, hookedMap, function (contextMap) {
                    utils.ergodicObject(this, contextMap, function (methodTask) {
                        methodTask.task.before = methodTask.task.before.filter(function (before) {
                            hasEq = hasEq || before.id === eqId;
                            return before.id !== eqId;
                        });
                        methodTask.task.after = methodTask.task.after.filter(function (after) {
                            hasEq = hasEq || after.id === eqId;
                            return after.id !== eqId;
                        });
                        if (methodTask.task.current && methodTask.task.current.id === eqId) {
                            methodTask.task.current = undefined;
                            hasEq = true;
                        }
                        if (methodTask.replace && methodTask.replace.id === eqId) {
                            methodTask.replace = undefined;
                            hasEq = true;
                        }
                    })
                });
            }
            return hasEq;
        },
        /**
         *  Methods to remove all hijacking-related methods
         * @inner
         * @memberOf EHook
         * @param context context
         * @param methodName method name
         */
        removeHookMethod: function (context, methodName) {
            if (!context[methodName] || !utils.isFunction(context[methodName])) {
                return;
            }
            this._getHookedMethodMap(context)[methodName] = {
                original: undefined,
                replace: undefined,
                task: {
                    before: [],
                    current: undefined,
                    after: []
                }
            };
        },
        /**
         * Determine if a method has been hijacked
         * @inner
         * @memberOf EHook
         * @param context
         * @param methodName
         */
        isHooked: function (context, methodName) {
            var hookMap = this._getHookedMethodMap(context);
            return hookMap[methodName] !== undefined ? (hookMap[methodName].original !== undefined) : false;
        },
        /**
         * Protect an object from being tampered with
         * @inner
         * @memberOf EHook
         * @param parent
         * @param methodName
         */
        protect: function (parent, methodName) {
            Object.defineProperty(parent, methodName, {
                configurable: false,
                writable: false
            });
        },
        preventError: function (parent, methodName, returnValue, context) {
            this.hookCurrent(parent, methodName, function (m, args) {
                var value = returnValue;
                try {
                    value = m.apply(this, args);
                } catch (e) {
                    console.log('Error Prevented from method ' + methodName, e);
                }
                return value;
            }, context)
        },
        /**
         * Load plugin
         * @inner
         * @memberOf EHook
         * @param option
         */
        plugins: function (option) {
            if (utils.isFunction(option.mount)) {
                var result = option.mount.call(this, utils);
                if (typeof option.name === 'string') {
                    _global[option.name] = result;
                }
            }
        }
    };
    if (_global.eHook && (_global.eHook instanceof EHook)) {
        return;
    }
    var eHook = new EHook();
    /**
     * @namespace AHook
     * @author Cangshi
     * @constructor
     * @see {@link https://palerock.cn/projects/006HDUuOhBj}
     * @license Apache License 2.0
     */
    var AHook = function () {
        this.isHooked = false;
        var autoId = 1;
        this._urlDispatcherList = [];
        this._getAutoId = function () {
            return autoId++;
        };
    };
    AHook.prototype = {
        /**
         * Execute the specified method group in the configuration list
         * @param xhr
         * @param methodName
         * @param args
         * @private
         */
        _invokeAimMethods: function (xhr, methodName, args) {
            var configs = utils.parseArrayByProperty(xhr.patcherList, 'config');
            var methods = [];
            utils.ergodicArrayObject(xhr, configs, function (config) {
                if (utils.isFunction(config[methodName])) {
                    methods.push(config[methodName]);
                }
            });
            return utils.invokeMethods(xhr, methods, args);
        },
        /**
         * Get the configuration list from the URL
         * @param url
         * @return {Array}
         * @private
         */
        _urlPatcher: function (url) {
            var patcherList = [];
            utils.ergodicArrayObject(this, this._urlDispatcherList, function (patcherMap, i) {
                if (utils.UrlUtils.urlMatching(url, patcherMap.patcher)) {
                    patcherList.push(patcherMap);
                }
            });
            return patcherList;
        },
        /**
         * Distribute callback requests based on the xhr object.
         * @param xhr
         * @param fullUrl
         * @private
         */
        _xhrDispatcher: function (xhr, fullUrl) {
            var url = utils.UrlUtils.getUrlWithoutParam(fullUrl);
            xhr.patcherList = this._urlPatcher(url);
        },
        /**
         * Conversion response event
         * @param e
         * @param xhr
         * @private
         */
        _parseEvent: function (e, xhr) {
            try {
                Object.defineProperties(e, {
                    target: {
                        get: function () {
                            return xhr;
                        }
                    },
                    srcElement: {
                        get: function () {
                            return xhr;
                        }
                    }
                });
            } catch (error) {
                console.warn('Redefining the return event failed; the hijacking response may fail.');
            }
            return e;
        },
        /**
         * Parsing the parameters of the open method
         * @param args
         * @private
         */
        _parseOpenArgs: function (args) {
            return {
                method: args[0],
                fullUrl: args[1],
                url: utils.UrlUtils.getUrlWithoutParam(args[1]),
                params: utils.UrlUtils.getParamFromUrl(args[1]),
                async: args[2]
            };
        },
        /**
         * Hijacking AJAX request parameters
         * @param argsObject
         * @param argsArray
         * @private
         */
        _rebuildOpenArgs: function (argsObject, argsArray) {
            argsArray[0] = argsObject.method;
            argsArray[1] = utils.UrlUtils.margeUrlAndParams(argsObject.url, argsObject.params);
            argsArray[2] = argsObject.async;
        },
        /**
         * Get the parameters of the hijacked method [original method, original method parameters, original method return value], and remove the original method parameters.
         * @param args
         * @return {*|Array.<T>}
         * @private
         */
        _getHookedArgs: function (args) {
            // Remove 'original method' from the parameters.
            return Array.prototype.slice.call(args, 0).splice(1);
        },
        /**
         * The method called when the response is triggered
         * @param outerXhr
         * @param funcArgs
         * @private
         */
        _onResponse: function (outerXhr, funcArgs) {
            // Because the parameters are hijacked and consist of [method(original method), args(parameters)], this method directly obtains the parameters and converts them into an array.
            var args = this._getHookedArgs(funcArgs);
            args[0][0] = this._parseEvent(args[0][0], outerXhr.xhr); // Force events to point to external xhr
            // Execute all method groups named hookResponse
            var results = this._invokeAimMethods(outerXhr, 'hookResponse', args);
            // Iterate through the result array and retrieve the last valid value as the response value.
            var resultIndex = -1;
            utils.ergodicArrayObject(outerXhr, results, function (res, i) {
                if (res != null) {
                    resultIndex = i;
                }
            });
            if (resultIndex !== -1) {
                outerXhr.xhr.responseText_ = outerXhr.xhr.response_ = results[resultIndex];
            }
        },
        /**
         * Manually start hijacking
         * @inner
         * @memberOf AHook
         */
        startHook: function () {
            var _this = this;
            var normalMethods = {
                // The `this` keyword in a method refers to the inner `xhr` method.
                // intercept response
                onreadystatechange: function () {
                    if (this.readyState == 4 && this.status == 200 || this.status == 304) {
                        _this._onResponse(this, arguments);
                    }
                },
                onload: function () {
                    _this._onResponse(this, arguments);
                },
                // intercept request
                open: function () {
                    var args = _this._getHookedArgs(arguments);
                    var fullUrl = args[0][1];
                    _this._xhrDispatcher(this, fullUrl);
                    var argsObject = _this._parseOpenArgs(args[0]);
                    this.openArgs = argsObject;
                    _this._invokeAimMethods(this, 'hookRequest', [argsObject]);
                    _this._rebuildOpenArgs(argsObject, args[0]);
                },
                send: function () {
                    var args = _this._getHookedArgs(arguments);
                    this.sendArgs = args;
                    _this._invokeAimMethods(this, 'hookSend', args);
                }
            };
            // Set the overall hookId
            this.___hookedId = _global.eHook.hookAjax(normalMethods);
            this.isHooked = true;
        },
        /**
         * Register ajaxUrl interceptor
         * @inner
         * @memberOf AHook
         * @param urlPatcher
         * @param configOrRequest
         * @param response
         * @return {number}
         */
        register: function (urlPatcher, configOrRequest, response) {
            if (!urlPatcher) {
                return -1;
            }
            if (!utils.isExistObject(configOrRequest) && !utils.isFunction(response)) {
                return -1;
            }
            var config = {};
            if (utils.isFunction(configOrRequest)) {
                config.hookRequest = configOrRequest;
            }
            if (utils.isFunction(response)) {
                config.hookResponse = response;
            }
            if (utils.isExistObject(configOrRequest)) {
                config = configOrRequest;
            }
            var id = this._getAutoId();
            this._urlDispatcherList.push({
                // Specifying an ID makes it easier to cancel later.
                id: id,
                patcher: urlPatcher,
                config: config
            });
            // The hijacking process automatically begins when a register is created.
            if (!this.isHooked) {
                this.startHook();
            }
            return id;
        }
        // todo Log out  cancellation: function (registerId){};
    };
 
    _global['eHook'] = eHook;
    _global['aHook'] = new AHook();
 
    return [{
        name: 'eHook',
        module: eHook
    }, {
        name: 'aHook',
        module: _global['aHook']
    }]
 
}));
 
/***/ }),
/* 1 */
/***/ (function(module) {
 
(function (global, factory) {
 
    "use strict";
 
    if ( true && typeof module.exports === "object") {
        module.exports = factory(global, true);
    } else {
        factory(global);
    }
 
}(typeof window !== "undefined" ? window : this, function (_global, noGlobal) {
 
    var map = Array.prototype.map;
    var forEach = Array.prototype.forEach;
    var reduce = Array.prototype.reduce;
 
    var BaseUtils = {
        /**
         * Is the object an array?
         * @param arr
         */
        isArray: function (arr) {
            return Array.isArray(arr) || Object.prototype.toString.call(arr) === "[object Array]";
        },
        /**
         * Determine if it is a method
         * @param func
         * @return {boolean}
         */
        isFunction: function (func) {
            if (!func) {
                return false;
            }
            return typeof func === 'function';
        },
        /**
         * Determine if it is a valid object
         * @param obj
         * @return {*|boolean}
         */
        isExistObject: function (obj) {
            return obj && (typeof obj === 'object');
        },
        isString: function (str) {
            if (str === null) {
                return false;
            }
            return typeof str === 'string';
        },
        uniqueNum: 1000,
        /**
         * Generate a random ID based on the current timestamp.
         * @returns {string}
         */
        buildUniqueId: function () {
            var prefix = new Date().getTime().toString();
            var suffix = this.uniqueNum.toString();
            this.uniqueNum++;
            return prefix + suffix;
        }
    };
 
    //
    var serviceProvider = {
        _parseDepends: function (depends) {
            var dependsArr = [];
            if (!BaseUtils.isArray(depends)) {
                return;
            }
            forEach.call(depends, function (depend) {
                if (BaseUtils.isString(depend)) {
                    dependsArr.push(serviceProvider[depend.toLowerCase()]);
                }
            });
            return dependsArr;
        }
    };
 
    var factory = function (name, depends, construction) {
        if (!BaseUtils.isFunction(construction)) {
            return;
        }
        serviceProvider[name.toLowerCase()] = construction.apply(this, serviceProvider._parseDepends(depends));
    };
 
    var depend = function (depends, construction) {
        if (!BaseUtils.isFunction(construction)) {
            return;
        }
        construction.apply(this, serviceProvider._parseDepends(depends));
    };
 
    factory('BaseUtils', [], function () {
        return BaseUtils;
    });
 
    // logger
    factory('logger', [], function () {
        return console;
    });
 
    // DateTimeUtils
    factory('DateTimeUtils', ['logger'], function (logger) {
        return {
            /**
             * Print current time
             */
            printNowTime: function () {
                var date = new Date();
                console.log(this.pattern(date, 'hh:mm:ss:S'));
            },
            /**
             * Format date
             * @param date
             * @param fmt
             * @returns {*}
             */
            pattern: function (date, fmt) {
                var o = {
                    "M+": date.getMonth() + 1, //月份
                    "d+": date.getDate(), //日
                    "h+": date.getHours() % 12 === 0 ? 12 : date.getHours() % 12, //小时
                    "H+": date.getHours(), //小时
                    "m+": date.getMinutes(), //分
                    "s+": date.getSeconds(), //秒
                    "q+": Math.floor((date.getMonth() + 3) / 3), //季度
                    "S": date.getMilliseconds() //毫秒
                };
                var week = {
                    "0": "/u65e5",
                    "1": "/u4e00",
                    "2": "/u4e8c",
                    "3": "/u4e09",
                    "4": "/u56db",
                    "5": "/u4e94",
                    "6": "/u516d"
                };
                if (/(y+)/.test(fmt)) {
                    fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
                }
                if (/(E+)/.test(fmt)) {
                    fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? "/u661f/u671f" : "/u5468") : "") + week[date.getDay() + ""]);
                }
                for (var k in o) {
                    if (new RegExp("(" + k + ")").test(fmt)) {
                        fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
                    }
                }
                return fmt;
            },
            /**
             * Get ID using the current time
             * @returns {number}
             */
            getCurrentId: function () {
                var date = new Date();
                return date.getTime();
            },
            /**
             * Get the time difference between a specified time and the present.
             * @param date {number|Date}
             * @param isCeil{boolean=} Whether to round the result up; the default is [false].
             * @param type {string=} The unit can take values ​​of ['day', 'month', 'year'], with the default being 'day'.
             * @returns {number}
             */
            getNowBetweenADay: function (date, isCeil, type) {
                if (!type) {
                    type = 'day'
                }
                if (typeof date === 'number') {
                    date = new Date(date);
                }
                if (!(date instanceof Date)) {
                    throw new TypeError('This parameter must be of type Date.')
                }
                var time = date.getTime();
                var now = new Date();
                var nowTime = now.getTime();
                if (nowTime - time < 0) {
                    logger.warn('The time to be calculated must be before the current time.');
                }
                var result = 0;
                switch (type) {
                    default:
                    case 'day':
                        result = (nowTime - time) / (1000 * 60 * 60 * 24);
                        break;
                    case 'month':
                        var yearDifference = now.getFullYear() - date.getFullYear();
                        if (yearDifference > 0) {
                            result += yearDifference * 12;
                        }
                        result += now.getMonth() - date.getMonth();
                        break;
                    case 'year':
                        result += now.getFullYear() - date.getFullYear();
                        break;
                }
                if (!isCeil) {
                    return Math.floor(result);
                } else {
                    if (result === 0 && isCeil) {
                        result = 1;
                    }
                    return Math.ceil(result);
                }
            }
        }
    });
 
    // ArrayUtils
    factory('ArrayUtils', ['BaseUtils'], function (BaseUtils) {
        return {
            isArrayObject: function (arr) {
                return BaseUtils.isArray(arr);
            },
            /**
             * Traverse array
             * @param context {Object}
             * @param arr {Array}
             * @param cb {Function} callback function
             */
            ergodicArrayObject: function (context, arr, cb) {
                if (!context) {
                    context = _global;
                }
                if (!BaseUtils.isArray(arr) || !BaseUtils.isFunction(cb)) {
                    return;
                }
                for (var i = 0; i < arr.length; i++) {
                    var result = cb.call(context, arr[i], i);
                    if (result && result === -1) {
                        break;
                    }
                }
            },
            /**
             * Get an action from a property of an array object
             * @param context {Object}
             * @param arr {Array}
             * @param propertyName {String}
             * @param cb {Function}
             * @param checkProperty {boolean} Exclude objects that do not have this property.[default:true]
             */
            getPropertyDo: function (context, arr, propertyName, cb, checkProperty) {
                if (checkProperty === null) {
                    checkProperty = true;
                }
                this.ergodicArrayObject(context, arr, function (ele) {
                    if (!checkProperty || ele.hasOwnProperty(propertyName)) {
                        cb.call(context, ele[propertyName], ele);
                    }
                })
            },
            /**
             * [Private method] Converts multiple key-value pair objects into a map.
             * @param arr {Array}
             * @returns {{}}
             */
            parseKeyValue: function (arr) {
                var map = {};
                if (!(BaseUtils.isArray(arr))) {
                    return map;
                }
                this.ergodicArrayObject(this, arr, function (ele) {
                    if (ele.key === null) {
                        return;
                    }
                    if (!map.hasOwnProperty(ele.key)) {
                        map[ele.key] = ele.value;
                    }
                });
                return map;
            },
            /**
             * Get the hash code of the array
             * @param arr {Array}
             * @returns {number}
             */
            getHashCode: function (arr) {
                var str = arr.toString();
                var hash = 31;
                if (str.length === 0) return hash;
                for (var i = 0; i < str.length; i++) {
                    var char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32bit integer
                }
                return hash;
            },
            /**
             * Generate a new array by specifying the properties of each object in the array.
             * @param arr {Array}
             * @param propertyName {String}
             */
            parseArrayByProperty: function (arr, propertyName) {
                var result = [];
                if (!this.isArrayObject(arr)) {
                    return result;
                }
                this.getPropertyDo(this, arr, propertyName, function (value) {
                    result.push(value);
                }, true);
                return result;
            },
            /**
             * Does the array object contain an object?
             * @param arr {Array}
             * @param obj
             * @param cb {function=}
             * @returns {boolean}
             */
            isContainsObject: function (arr, obj, cb) {
                var isContainsObject = false;
                this.ergodicArrayObject(this, arr, function (value, i) {
                    if (obj === value) {
                        isContainsObject = true;
                        if (BaseUtils.isFunction(cb)) {
                            cb.call(_global, i);
                        }
                        return -1;
                    }
                });
                return isContainsObject;
            },
            /**
             * Get the maximum value in the array
             * @param arr If the objects in the array are also arrays, then perform multi-level comparisons for each object in each of the arrays.
             * @param cb
             * @returns {*}
             */
            getMaxInArray: function (arr, cb) {
                var maxObject = null;
                var maxIndex = -1;
                while (maxObject === null && maxIndex < arr.length) {
                    maxObject = arr[++maxIndex]
                }
                for (var i = maxIndex + 1; i < arr.length; i++) {
                    // If the objects being compared are arrays, then the first element of each array is compared; if they are the same, the second element is compared.
                    if (maxObject !== null && this.isArrayObject(maxObject) && this.isArrayObject(arr[i])) {
                        var classLength = maxObject.length;
                        var classLevel = 0;
                        // console.log(maxObject[classLevel],arr[i][classLevel]);
                        while (maxObject[classLevel] === arr[i][classLevel] && classLevel < classLength) {
                            classLevel++
                        }
                        if (maxObject[classLevel] !== null && maxObject[classLevel] < arr[i][classLevel]) {
                            maxObject = arr[i];
                            maxIndex = i;
                        }
                        continue;
                    }
                    if (maxObject !== null && maxObject < arr[i]) {
                        maxObject = arr[i];
                        maxIndex = i;
                    }
                }
                if (BaseUtils.isFunction(cb)) {
                    cb.call(this, maxObject, maxIndex);
                }
                return maxObject;
            },
            /**
             * Get the total value in the array
             * @param arr{Array<number>}
             * @param cb {function=}
             */
            getSumInArray: function (arr, cb) {
                if (!this.isArrayObject(arr)) {
                    return;
                }
                var sum = 0;
                var count = 0;
                this.ergodicArrayObject(this, arr, function (value) {
                    if (typeof value === 'number' && !Number.isNaN(value)) {
                        sum += value;
                        count += 1;
                    }
                });
                if (BaseUtils.isFunction(cb)) {
                    cb.call(_global, sum, count);
                }
                return sum;
            },
            /**
             * Get the average value of an array
             * @param arr{Array<number>}
             */
            getAverageInArray: function (arr) {
                var average = 0;
                this.getSumInArray(arr, function (sum, i) {
                    i === 0 || (average = sum / i);
                });
                return average;
            },
            /**
             * Sort an array
             * @param arr
             * @param order
             * @param sortSetting {object=}
             */
            sortingArrays: function (arr, order, sortSetting) {
                if (!this.isArrayObject(arr)) {
                    return;
                }
                var DESC = 0;
                var ASC = 1;
                var thisArr = arr.slice(0);
                var _thisAction = null;
                // Parse configuration
                var isSetting = sortSetting && sortSetting.getComparedProperty &&
                    BaseUtils.isFunction(sortSetting.getComparedProperty);
                if (isSetting) {
                    thisArr = sortSetting.getComparedProperty(arr);
                }
                switch (order) {
                    default :
                    case DESC:
                        _thisAction = thisArr.push;
                        break;
                    case ASC:
                        _thisAction = thisArr.unshift;
                        break;
                }
                var resultArr = [];
                for (var j = 0; j < thisArr.length; j++) {
                    this.getMaxInArray(thisArr, function (max, i) {
                        delete thisArr[i];
                        _thisAction.call(resultArr, arr[i]);
                    });
                }
                if (sortSetting && sortSetting.createNewData) {
                    return resultArr.slice(0);
                }
                return resultArr;
            },
            /**
             * Convert an array-like object to an array.
             * @param arrLike array-like object
             */
            toArray: function (arrLike) {
                if (!arrLike || arrLike.length === 0) {
                    return [];
                }
                // For non-pseudo-class objects, it's best to return them directly.
                if (!arrLike.length) {
                    return arrLike;
                }
                // COM implementation of the DOM prior to IE8
                try {
                    return [].slice.call(arrLike);
                } catch (e) {
                    var i = 0,
                        j = arrLike.length,
                        res = [];
                    for (; i < j; i++) {
                        res.push(arrLike[i]);
                    }
                    return res;
                }
            },
            /**
             * Determine if it is an array-like object
             * @param o
             * @returns {boolean}
             */
            isArrayLick: function (o) {
                if (o &&                                // o is not null, undefined, etc.
                    typeof o === 'object' &&            // o is an object
                    isFinite(o.length) &&               // o.length is a finite number
                    o.length >= 0 &&                    // o.length is non-negative
                    o.length === Math.floor(o.length) &&  // o.length is an integer
                    o.length < 4294967296)              // o.length < 2^32
                    return true;                        // Then o is array-like
                else
                    return false;                       // Otherwise it is not
 
            },
            /**
             * Determine if an array contains objects
             * @param arr
             * @param obj
             */
            contains: function (arr, obj) {
                var contains = false;
                this.ergodicArrayObject(this, arr, function (a) {
                    if (a === obj) {
                        contains = true;
                        return -1;
                    }
                });
                return contains;
            }
        }
    });
 
    // ObjectUtils
    factory('ObjectUtils', ['ArrayUtils', 'BaseUtils'], function (ArrayUtils, BaseUtils) {
        return {
            /**
             * Retrieving object properties [Supports chained expressions, such as retrieving the school of a student's class](student.class.school):'class.school']
             * @param obj
             * @param linkProperty {string|Array} Attribute expressions; use an array to retrieve multiple attributes.
             * @param cb {function=}
             * @return Object properties
             */
            readLinkProperty: function (obj, linkProperty, cb) {
                var callback = null;
                if (BaseUtils.isFunction(cb)) {
                    callback = cb;
                }
                if (typeof linkProperty === 'string') {
                    // Remove all spaces
                    linkProperty = linkProperty.replace(/ /g, '');
                    // Values ​​not considered null
                    if (linkProperty === '') {
                        return null;
                    }
                    // If it is a pseudo-array separated by commas, then convert it to an array before performing operations.
                    if (linkProperty.indexOf(',') !== -1) {
                        var propertyNameArr = linkProperty.split(',');
                        return this.readLinkProperty(obj, propertyNameArr, callback);
                    }
                    if (linkProperty.indexOf('.') !== -1) {
                        var names = linkProperty.split('.');
                        var iterationObj = obj;
                        var result = null;
                        ArrayUtils.ergodicArrayObject(this, names, function (name, i) {
                            iterationObj = this.readLinkProperty(iterationObj, name);
                            if (names[names.length - 1] === name && names.length - 1 === i) {
                                result = iterationObj;
                                if (callback) {
                                    callback.call(_global, result, linkProperty);
                                }
                            }
                            // Terminate the traversal of the next attribute.
                            if (typeof iterationObj === 'undefined') {
                                return -1;
                            }
                        });
                        return result;
                    }
                    var normalResult = null;
                    if (linkProperty.slice(linkProperty.length - 2) === '()') {
                        var func = linkProperty.slice(0, linkProperty.length - 2);
                        normalResult = obj[func]();
                    } else {
                        normalResult = obj[linkProperty];
                    }
                    if (normalResult === null) {
                        console.warn(obj, 'Attributes[\'' + linkProperty + '\']value not found');
                    }
                    if (callback) {
                        callback.call(_global, normalResult, linkProperty);
                    }
                    return normalResult;
                }
                if (BaseUtils.isArray(linkProperty)) {
                    var results = [];
                    ArrayUtils.ergodicArrayObject(this, linkProperty, function (name) {
                        var value = this.readLinkProperty(obj, name);
                        results.push(value);
                        if (callback && name !== '') {
                            return callback.call(_global, value, name);
                        }
                    });
                    results.isMultipleResults = true;
                    return results;
                }
            },
            /**
             * Assigning values ​​to object properties
             * （An object cannot contain both property names that begin with a number and regular property names.）
             * @param obj
             * @param linkProperty {string|Array} Attribute expressions; multiple attributes are expressed using an array.
             * @param value
             */
            createLinkProperty: function (obj, linkProperty, value) {
                if (obj === null) {
                    obj = {};
                }
                if (typeof linkProperty === 'string') {
                    // Remove all spaces
                    linkProperty = linkProperty.replace(/ /g, '');
                    // Values ​​not considered null
                    if (linkProperty === '') {
                        throw new TypeError('Object property names cannot be empty.')
                    }
                    if (linkProperty.indexOf(',') !== -1) {
                        var propertyNameArr = linkProperty.split(',');
                        this.createLinkProperty(obj, propertyNameArr, value);
                        return obj;
                    }
                    if (linkProperty.indexOf('.') !== -1) {
                        var names = linkProperty.split('.');
                        if (!obj.hasOwnProperty(names[0])) {
                            obj[names[0]] = {}
                        }
                        // Check if the attribute name starts with a number (if so, it means it's an array).
                        if (!Number.isNaN(parseInt(names[0]))) {
                            if (!ArrayUtils.isArrayObject(obj)) {
                                obj = [];
                            }
                        }
                        var propertyObj = obj[names[0]];
                        var newProperties = names.slice(1, names.length);
                        var newLinkProperty = '';
                        ArrayUtils.ergodicArrayObject(this, newProperties, function (property, i) {
                            if (i < newProperties.length - 1) {
                                newLinkProperty = newLinkProperty + property + '.'
                            } else {
                                newLinkProperty = newLinkProperty + property;
                            }
                        });
                        obj[names[0]] = this.createLinkProperty(propertyObj, newLinkProperty, value);
                        return obj;
                    }
                    // Check if the attribute name starts with a number (if so, it means it's an array).
                    if (!Number.isNaN(parseInt(linkProperty))) {
                        if (!ArrayUtils.isArrayObject(obj)) {
                            obj = [];
                        }
                    }
                    obj[linkProperty] = value;
                    return obj;
                } else if (BaseUtils.isArray(linkProperty)) {
                    ArrayUtils.ergodicArrayObject(this, linkProperty, function (link) {
                        obj = this.createLinkProperty(obj, link, value);
                    });
                    return obj;
                }
            },
            /**
             * Traversing object properties
             * @param context {object} context
             * @param obj {object} Traverse objects
             * @param cb {function} callback function
             * @param isReadInnerObject {boolean=} Does iterate over the properties of the internal object?
             */
            ergodicObject: function (context, obj, cb, isReadInnerObject) {
                var keys = Object.keys(obj);
                ArrayUtils.ergodicArrayObject(this, keys, function (propertyName) {
                    // If the internal object needs to be traversed
                    var _propertyName = propertyName;
                    if (isReadInnerObject && obj[propertyName] !== null && typeof obj[propertyName] === 'object') {
                        this.ergodicObject(this, obj[propertyName], function (value, key) {
                            return cb.call(context, value, _propertyName + '.' + key);
                        }, true)
                    } else {
                        return cb.call(context, obj[propertyName], propertyName);
                    }
                })
            },
            /**
             * Execute the return function when the specified property is empty or does not exist.；
             * @param context {object} context
             * @param obj {object} Detection object
             * @param propertyNames{Array|string} Attribute name to be detected
             *                                     It can check multi-level attributes such as:'a.b.c.e'，
             *                                     Multiple attributes can be used in an array; plain strings are also supported. Multiple attributes are separated by commas.
             * @param cb {function} Callback function [parameter: empty or non-existent property name; if the return value is '-1', skip subsequent callback functions]
             */
            whileEmptyObjectProperty: function (context, obj, propertyNames, cb) {
                // Parsing a single property name
                if (typeof propertyNames === 'string') {
                    // Remove all spaces
                    propertyNames = propertyNames.replace(/ /g, '');
                    // Values ​​not considered null
                    if (propertyNames === '') {
                        return;
                    }
                    // If it is a pseudo-array separated by commas, then convert it to an array before performing operations.
                    if (propertyNames.indexOf(',') !== -1) {
                        var propertyNameArr = propertyNames.split(',');
                        return this.whileEmptyObjectProperty(context, obj, propertyNameArr, cb);
                    }
                    // If a cascade property is specified
                    if (propertyNames.indexOf('.') !== -1) {
                        var names = propertyNames.split('.');
                        var iterationObj = obj;
                        var result = null;
                        ArrayUtils.ergodicArrayObject(this, names, function (name) {
                            if (iterationObj && iterationObj.hasOwnProperty(name)) {
                                iterationObj = iterationObj[name];
                            } else {
                                result = cb.call(_global, propertyNames);
                                // Terminate the traversal of the next attribute.
                                return -1;
                            }
                        });
                        return result;
                    }
                    // normal process
                    if (!obj.hasOwnProperty(propertyNames)) {
                        return cb.call(context, propertyNames);
                    }
                    if (obj[propertyNames] === null || obj[propertyNames] === '') {
                        return cb.call(context, propertyNames);
                    }
                } else if (BaseUtils.isArray(propertyNames)) {
                    // parse array
                    var _this = this;
                    ArrayUtils.ergodicArrayObject(this, propertyNames, function (propertyName) {
                        // recursive call
                        return _this.whileEmptyObjectProperty(context, obj, propertyName, cb);
                    })
                }
            },
            whileEmptyObjectPropertyV2: function (context, obj, propertyNames, cb) {
                this.readLinkProperty(obj, propertyNames, function (value, propertyName) {
                    if (value === null || value === '' || parseInt(value) < 0) {
                        return cb.call(context, propertyName);
                    }
                })
            },
            /**
             * Clone an object [clone only properties, not the prototype chain].
             * @param obj {*}
             */
            cloneObject: function (obj) {
                var newObj = {};
                // Check if it is a basic data type; if so, return directly.
                if (typeof obj === 'string' ||
                    typeof obj === 'number' ||
                    typeof obj === 'undefined' ||
                    typeof obj === 'function' ||
                    typeof obj === 'boolean') {
                    return obj;
                }
                // Determine if it is an array
                if (BaseUtils.isArray(obj)) {
                    newObj = [];
                    // Iterate through the array and recursively call the method to obtain clones of the objects inside the array and push them into the new array.
                    ArrayUtils.ergodicArrayObject(this, obj, function (arrObjValue) {
                        newObj.push(this.cloneObject(arrObjValue));
                    })
                } else if (typeof obj === 'object') {
                    // When the target is a general object, i.e., typeof is object.
                    if (obj === null) {
                        // Returns null if the cloned object is null.
                        return null;
                    }
                    // Iterate through the properties of an object and call the recursive method to obtain a clone of the object corresponding to that property and reassign it to that property.
                    this.ergodicObject(this, obj, function (value, key) {
                        newObj[key] = this.cloneObject(value);
                    });
                }
                return newObj;
            },
            /**
             * Get the hash code of the object
             * @param obj {Object}
             * @returns {number}
             */
            getObjHashCode: function (obj) {
                var str = JSON.stringify(obj);
                var hash = 0, i, chr, len;
                console.log(str)
                console.log(hash)
                if (str.length === 0) return hash;
                for (i = 0, len = str.length; i < len; i++) {
                    chr = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + chr;
                    hash |= 0; // Convert to 32bit integer
                }
                console.log(str)
                console.log(hash)
                return hash;
            },
            /**
             * Extended object properties
             * @param obj original object
             * @param extendedObj extended object
             * @param isCover {boolean=} Whether to overwrite an extended property when it conflicts with the original property. Default: [false]
             * @param isClone {boolean=} Whether to return a new object; the default is [false], which returns the expanded original object.
             */
            expandObject: function (obj, extendedObj, isCover, isClone) {
                var resultObj = obj;
                if (isClone) {
                    resultObj = this.cloneObject(obj);
                }
                this.ergodicObject(this, extendedObj, function (value, key) {
                    if (isCover && this.readLinkProperty(resultObj, key) !== null) {
                        return;
                    }
                    resultObj = this.createLinkProperty(resultObj, key, value);
                }, true);
                return resultObj;
            },
            /**
             * Sort an array, and when the elements in the array are objects, sort them according to the property names of the specified objects.
             * @param arr array
             * @param propertyName Attribute names (multi-level sorting when there are multiple attribute names)
             * @param order Ascending and descending order
             * @returns {*}
             */
            sortingArrayByProperty: function (arr, propertyName, order) {
                var _this = this;
                var sortSetting = {
                    // Whether to create new data
                    createNewData: false,
                    // This method retrieves the comparison property from each object in the array.
                    getComparedProperty: function (arr) {
                        var compareArr = [];
                        ArrayUtils.ergodicArrayObject(_this, arr, function (obj, i) {
                            if (typeof obj !== 'object') {
                                compareArr.push(obj);
                            } else {
                                var compareValue = this.readLinkProperty(obj, propertyName);
                                if (compareValue !== null) {
                                    compareArr.push(compareValue);
                                } else {
                                    compareArr.push(obj);
                                }
                            }
                        });
                        return compareArr.slice(0);
                    }
                };
                return ArrayUtils.sortingArrays(arr, order, sortSetting);
            },
            /**
             * Examples of turning conversation into a target
             * @param constructor {function} Constructor
             * @param obj {object|Array}object of judgment
             * @param defaultProperty {object=}
             */
            toAimObject: function (obj, constructor, defaultProperty) {
                if (BaseUtils.isArray(obj)) {
                    var originArr = [];
                    ArrayUtils.ergodicArrayObject(this, obj, function (value) {
                        originArr.push(this.toAimObject(value, constructor, defaultProperty));
                    });
                    return originArr;
                } else if (typeof obj === 'object') {
                    if (defaultProperty) {
                        this.ergodicObject(this, defaultProperty, function (value, key) {
                            if (obj[key] === null) {
                                obj[key] = value;
                            }
                        });
                    }
                    if (obj instanceof constructor) {
                        return obj;
                    }
                    var originObj = obj;
                    while (originObj.__proto__ !== null && originObj.__proto__ !== Object.prototype) {
                        originObj = originObj.__proto__;
                    }
                    originObj.__proto__ = constructor.prototype;
                    return originObj;
                }
            },
            /**
             * Merge objects with similar structures in an array into a single array by specifying their properties.
             * @param arr {Array}
             * @param propertyNames
             */
            parseTheSameObjectPropertyInArray: function (arr, propertyNames) {
                var result = {};
                var temp = {};
                ArrayUtils.ergodicArrayObject(this, arr, function (obj) {
                    // Retrieve all desired properties and store them in temp using property names as key-value pairs.
                    this.readLinkProperty(obj, propertyNames, function (value, property) {
                        if (!temp.hasOwnProperty(property) || !(BaseUtils.isArray(temp[property]))) {
                            temp[property] = [];
                        }
                        temp[property].push(value);
                    });
                });
                // Iterate through temp to get the value of each key and extract it individually.
                this.ergodicObject(this, temp, function (value, key) {
                    result = this.createLinkProperty(result, key, value);
                });
                return this.cloneObject(result);
            },
            /**
             * Merge objects with similar structures in an array into a single array by specifying their properties.
             * @param arr {Array}
             */
            parseTheSameObjectAllPropertyInArray: function (arr) {
                if (!ArrayUtils.isArrayObject(arr) || arr.length < 1) {
                    return;
                }
                // Retrieve all properties of an object, including properties of its internal objects.
                var propertyNames = [];
                this.ergodicObject(this, arr[0], function (v, k) {
                    propertyNames.push(k);
                }, true);
                return this.parseTheSameObjectPropertyInArray(arr, propertyNames);
            },
            /**
             * Get object properties; if it's an array, calculate the average of its numbers or other properties.
             * @param obj
             * @param propertyNames{Array<string>|string}
             * @param type
             */
            getCalculationInArrayByLinkPropertyNames: function (obj, propertyNames, type) {
                var resultObject = {};
                var _this = this;
                switch (type) {
                    default:
                    case 'sum':
                        this.readLinkProperty(obj, propertyNames, function (value, key) {
                            if (ArrayUtils.isArrayObject(value)) {
                                resultObject = _this.createLinkProperty(resultObject, key, ArrayUtils.getSumInArray(value));
                            }
                        });
                        break;
                    case 'average':
                        this.readLinkProperty(obj, propertyNames, function (value, key) {
                            if (ArrayUtils.isArrayObject(value)) {
                                resultObject = _this.createLinkProperty(resultObject, key, ArrayUtils.getAverageInArray(value));
                            }
                        });
                        break;
                }
                return resultObject;
            }
        }
    });
 
    // ColorUtils
    factory('ColorUtils', [], function () {
        return {
            /**
             * Convert RGB color to hexadecimal
             * @param r
             * @param g
             * @param b
             * @return {string}
             */
            rgbToHex: function (r, g, b) {
                var hex = ((r << 16) | (g << 8) | b).toString(16);
                return "#" + new Array(Math.abs(hex.length - 7)).join("0") + hex;
            },
            /**
             * Convert color from hexadecimal to RGB
             * @param hex
             * @return {Array}
             */
            hexToRgb: function (hex) {
                hex = hex.replace(/ /g, '');
                var length = hex.length;
                var rgb = [];
                switch (length) {
                    case 4:
                        rgb.push(parseInt(hex[1] + hex[1], 16));
                        rgb.push(parseInt(hex[2] + hex[2], 16));
                        rgb.push(parseInt(hex[3] + hex[3], 16));
                        return rgb;
                    case 7:
                        for (var i = 1; i < 7; i += 2) {
                            rgb.push(parseInt("0x" + hex.slice(i, i + 2)));
                        }
                        return rgb;
                    default:
                        break
                }
            },
            /**
             * Obtain the gradient color based on the two colors and the percentage between them.
             * @param start
             * @param end
             * @param percentage
             * @return {*}
             */
            gradientColorsPercentage: function (start, end, percentage) {
                var resultRgb = [];
                var startRgb = this.hexToRgb(start);
                if (end == null) {
                    return start;
                }
                var endRgb = this.hexToRgb(end);
                var totalR = endRgb[0] - startRgb[0];
                var totalG = endRgb[1] - startRgb[1];
                var totalB = endRgb[2] - startRgb[2];
                resultRgb.push(startRgb[0] + totalR * percentage);
                resultRgb.push(startRgb[1] + totalG * percentage);
                resultRgb.push(startRgb[2] + totalB * percentage);
                return this.rgbToHex(resultRgb[0], resultRgb[1], resultRgb[2])
            }
        }
    });
 
    factory('FunctionUtils', [], function () {
        return {
            /**
             * Get the name of the method
             * @param func
             * @returns {*}
             */
            getFunctionName: function (func) {
                if (typeof func === 'function' || typeof func === 'object') {
                    var name = ('' + func).match(/function\s*([\w\$]*)\s*\(/);
                }
                return func.name || name[1];
            },
            /**
             * Get the parameter name of the method
             * @param func
             * @returns {*}
             */
            getFunctionParams: function (func) {
                if (typeof func === 'function' || typeof func === 'object') {
                    var name = ('' + func).match(/function.*\(([^)]*)\)/);
                    return name[1].replace(/( )|(\n)/g, '').split(',');
                }
            },
            /**
             * Get the function that called the method through the method's arguments.
             * @param func_arguments
             * @returns {string}
             */
            getCallerName: function (func_arguments) {
                var caller = func_arguments.callee.caller;
                var callerName = '';
                if (caller) {
                    callerName = this.getFunctionName(caller);
                }
                return callerName;
            },
            FunctionBuilder: function (func) {
                var _this = this;
                var fs = [];
                fs.push(func);
                var properties = ['push', 'unshift', 'slice', 'map', 'forEach', 'keys', 'find', 'concat', 'fill', 'shift', 'values'];
                map.call(properties, function (property) {
                    if (typeof Array.prototype[property] === 'function') {
                        Object.defineProperty(_this, property, {
                            get: function () {
                                return function () {
                                    fs[property].apply(fs, arguments);
                                    return this;
                                }
                            }
                        });
                    }
                });
                this.result = function (context) {
                    var rfs = [];
                    map.call(fs, function (f, index) {
                        if (typeof f === 'function') {
                            rfs.push(f);
                        }
                    });
                    return function () {
                        var declareVar = {
                            arguments: arguments,
                            this: this
                        };
                        map.call(rfs, function (f) {
                            var dv = f.apply(context || this, [declareVar]);
                            if (dv) {
                                map.call(Object.keys(dv), function (key) {
                                    declareVar[key] = dv[key];
                                });
                            }
                        });
                        return declareVar.returnValue;
                    }
                }
            },
            invokeMethods: function (context, methods, args) {
                if (!this.isArray(methods)) {
                    return;
                }
                var results = [];
                var _this = this;
                this.ergodicArrayObject(context, methods, function (method) {
                    if (!_this.isFunction(method)) {
                        return;
                    }
                    results.push(
                        method.apply(context, args)
                    );
                });
                return results;
            }
        }
    });
 
    factory('UrlUtils', [], function () {
        return {
            urlMatching: function (url, matchUrl) {
                var pattern = new RegExp(matchUrl);
                return pattern.test(url);
            },
            getUrlWithoutParam: function (url) {
                return url.split('?')[0];
            },
            getParamFromUrl: function (url) {
                var params = [];
                var parts = url.split('?');
                if (parts.length < 2) {
                    return params;
                }
                var paramsStr = parts[1].split('&');
                for (var i = 0; i < paramsStr.length; i++) {
                    var index = paramsStr[i].indexOf('=');
                    var ps = new Array(2);
                    if (index !== -1) {
                        ps = [
                            paramsStr[i].substring(0, index),
                            paramsStr[i].substring(index + 1),
                        ];
                    } else {
                        ps[0] = paramsStr[i];
                    }
                    params.push({
                        key: ps[0],
                        value: ps[1]
                    });
                }
                return params;
            },
            margeUrlAndParams: function (url, params) {
                if (url.indexOf('?') !== -1 || !(params instanceof Array)) {
                    return url;
                }
                var paramsStr = [];
                for (var i = 0; i < params.length; i++) {
                    if (params[i].key !== null && params[i].value !== null) {
                        paramsStr.push(params[i].key + '=' + params[i].value);
                    }
                }
                return url + '?' + paramsStr.join('&');
            }
        }
    });
 
    factory('PointUtils', [], function () {
        var Point2D = function (x, y) {
            this.x = x || 0;
            this.y = y || 0;
        };
        Point2D.prototype = {
            constructor: Point2D,
            /**
             * Get the plane point corresponding to a specified distance and angle
             * @param distance
             * @param deg
             */
            getOtherPointFromDistanceAndDeg: function (distance, deg) {
                var radian = Math.PI / 180 * deg;
                var point = new this.constructor();
                point.x = distance * Math.sin(radian) + this.x;
                point.y = this.y - distance * Math.cos(radian);
                return point;
            },
            /**
             * Get the distance between the current plane point and another plane point.
             * @param p
             * @returns {number}
             */
            getDistanceFromAnotherPoint: function (p) {
                return Math.sqrt((this.x - p.x) * (this.x - p.x) + (this.y - p.y) * (this.y - p.y));
            },
            /**
             * Get the angle between the current plane point and another plane point.
             * @param p
             * @returns {number}
             */
            getDegFromAnotherPoint: function (p) {
                var usedPoint = new Point2D(p.x * 1000000 - this.x * 1000000, p.y * 1000000 - this.y * 1000000);
                var radian = Math.atan2(usedPoint.x * 1000000, usedPoint.y * 1000000);
                var deg = radian * 180 / Math.PI;
                return 180 - deg;
            },
            /**
             * Determine if the point is inside a rectangle.
             * @param x The starting coordinates of the rectangle are x
             * @param y The starting coordinate of the rectangle is y.
             * @param width Rectangle width
             * @param height Rectangle length
             * @returns {boolean}
             */
            isInRect: function (x, y, width, height) {
                var px = this.x;
                var py = this.y;
                if (px < x || px > x + width) {
                    return false;
                }
                return !(py < y || py > y + height);
            }
        };
        return {
            Point2D: Point2D
        }
    });
 
 
    factory('PropExpand', ['BaseUtils', 'ObjectUtils', 'ArrayUtils', 'UrlUtils'],
        function (BaseUtils, ObjectUtils, ArrayUtils, UrlUtils) {
            return {
                Object: {
                    getProperty: function (_self, propertyLink) {
                        return ObjectUtils.readLinkProperty(_self, propertyLink);
                    },
                    setProperty: function (_self, propertyLink, value) {
                        ObjectUtils.createLinkProperty(_self, propertyLink, value);
                    },
                    mapConvert: function (_self, mapper) {
 
                    },
                    keyMap: function (_self, cb) {
                    },
                    keyValues: function (_self, cb) {
                    },
                    keyFilter: function (_self, cb) {
                    },
                },
                Array: {
                    map: function () {
                    },
                    forEach: function () {
                    },
                    filter: function () {
                    },
                    reduce: function () {
                    },
                    keep: function () {
                    },
                    remove: function () {
                    }
                },
                String: {
                    join: function (_self, arr) {
                    },
                }
            }
        });
 
    _global.everyUtils = function () {
        if (BaseUtils.isArray(arguments[0])) {
            depend.call(arguments[2] || this, arguments[0], arguments[1]);
        } else if (BaseUtils.isFunction(arguments[0])) {
            var args = arguments;
            depend.call(arguments[1] || this, ['FunctionUtils'], function (FunctionUtils) {
                var depends = FunctionUtils.getFunctionParams(args[0]);
                depend(depends, args[0]);
            })
        }
    };
 
    _global.eUtils = (function () {
        var utils = {};
        if (_global.everyUtils) {
            _global.everyUtils([
                'ArrayUtils', 'ObjectUtils', 'BaseUtils', 'FunctionUtils', 'ColorUtils', 'PointUtils', 'UrlUtils'
            ], function (
                ArrayUtils,
                ObjectUtils,
                BaseUtils,
                FunctionUtils,
                ColorUtils,
                PointUtils,
                UrlUtils) {
                utils = {
                    ArrayUtils: ArrayUtils,
                    ObjectUtils: ObjectUtils,
                    BaseUtils: BaseUtils,
                    ColorUtils: ColorUtils,
                    UrlUtils: UrlUtils,
                    urlUtils: UrlUtils,
                    PointUtils: PointUtils,
                    FunctionUtils: FunctionUtils
                };
            });
        }
        var proxy = {};
        forEach.call(Object.keys(utils), function (utilName) {
            if (!utilName) {
                return;
            }
            Object.defineProperty(proxy, utilName, {
                get: function () {
                    return utils[utilName];
                }
            });
            forEach.call(Object.keys(utils[utilName]), function (key) {
                if (!key) {
                    return;
                }
                if (proxy[key]) {
                    return;
                }
                Object.defineProperty(proxy, key, {
                    get: function () {
                        return utils[utilName][key];
                    }
                })
            })
        });
        return proxy;
    })();
 
    return _global.eUtils;
}));
 
/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	// module exports must be returned from runtime so entry inlining is disabled
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })()
;
});
