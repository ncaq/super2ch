// ==UserScript==
// @name        super2ch
// @version     3.1
// @author      wowo
// @license     The MIT License
// @namespace   http://my.opera.com/crckyl/
// @include     http://*
// ==/UserScript==

/* Change log
 *
 * 3.1 - 2013/03/09
 *  * 被参照レスポップアップでレスをツリー状に展開するように変更。
 *  * アンカーの処理を改善。
 *   * >>1->>3 のようなアンカーを >>1,3 と同等に扱っていたバグを修正。
 *   * >>1>>3 のように連続したアンカーが正しく処理されていなかったバグを修正。
 *  * 本文中の ID アンカーの着色が正しく処理されていなかったバグを修正。
 *   * 対象 ID による書き込みがスレッドに存在しない場合、例外で処理が止まっていた。
 *
 * 3.0 - 2013/02/20
 *  * 初版。
 */

(function(super2ch) {
  if (window !== window.top) {
    return;
  }

  var conf = {
    // maxAnchorExtent 以上の範囲アンカーは無視する
    // >>1-1000 のようなアンカーが被参照ポップアップに現れなくなる
    maxAnchorExtent: 32,
    ignoredAnchorColor: '#666',

    color: {
      num: { // レス番ハイライト
        0: '#00f',
        1: '#808',
        3: '#f00'
      },

      id: { // IDハイライト
        0: '#888',
        1: '#000',
        2: '#00f',
        5: '#f00'
      }
    },

    popup: {
      // ポップアップが固定されるまでの時間(ミリ秒)
      // ポップアップを表示してから pinTime 以内にカーソルがアンカーから離れるとポップアップを消す
      // 0 なら待たずに固定する
      pinTime: 100,
      // 一つのポップアップには maxResCount 個までしかレスを表示しない
      maxResCount: 20,
      // レスツリーの最大深度
      // 0 ならツリー表示しない(旧バージョンと同等)
      maxTreeDepth: 3
    },

    urls: [
      { // 汎用
        url: /\/(?:test|bbs)\/read\.(?:cgi|so|php|pl|py)\//,
        run: true
      }, { // URIエンコード汎用
        url: /%2F(?:test|bbs)%2Fread\.(?:cgi|so|php|pl|py)%2F/,
        run: true
      }, { // 2ch過去ログ
        url: /\.2ch\.net\/.*\/kako\/(?:.*\/)?\d+\.htm/,
        run: true
      }, { // したらば過去ログ
        url: /\/jbbs\.livedoor\.jp\/.*\/storage\/(?:.*\/)?\d+\.htm/,
        run: true
      }, { // yy過去ログ
        url: /\/yy\d*\.(?:\d+\.kg|kakiko\.com)\/.*\/kako\/(?:.*\/)?\d+\.htm/,
        run: true
      }, { // まちBBS旧URL?
        url: /\.machi\.to\/bbs\/read\.pl\?/,
        run: true
      }, { // 公式P2では実行しない
        url: /[\/\.]p2\.2ch\.net\//,
        run: false
      }, { // rep2では実行しない
        url: /\/rep2(?:ex(?:pack)?)?\//,
        run: false
      }
    ]
  };

  var run = false;
  for(var i = 0; i < conf.urls.length; ++i) {
    if (conf.urls[i].url.test(window.location.href)) {
      run = conf.urls[i].run;
      if (!run) {
        break;
      }
    }
  }

  if (run || (window.super2ch || {}).forceRun) {
    super2ch(window.super2ch = {
      conf: conf
    });
  }

})(function(_) {

  _.escapeHTML = (function() {
    var re    = /[&<>"']/g,
        table = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };

    return function(text) {
      return text.replace(re, function(chr) {
        return table[chr];
      });
    };
  })();

  _.basepath = window.location.pathname.replace(/[^\/]+$/, '');
  _.basepathHTML = _.escapeHTML(_.basepath);

  _.re = (function() {
    var toAscii = (function() {
      var re    = /[\uff10-\uff19]/g,
          table = {
            '\uff10': 0,
            '\uff11': 1,
            '\uff12': 2,
            '\uff13': 3,
            '\uff14': 4,
            '\uff15': 5,
            '\uff16': 6,
            '\uff17': 7,
            '\uff18': 8,
            '\uff19': 9
          };

      return function(text) {
        return text.replace(re, function(chr) {
          return table[chr];
        });
      };
    })();

    var composeAnchor = function(str) {
      var html, targets = [];

      html = str.replace(
        _.re.anchorExtractor,
        function(all, min, max) {
          var style = '';

          min = parseInt(toAscii(min));
          max = max ? parseInt(toAscii(max)) : min;

          if (max < min) {
            var tmp = min;
            min = max;
            max = tmp;
          }

          var link = _.basepathHTML + min;
          if (max > min) {
            link += '-' + max;
          }

          if (max - min + 1 <= _.conf.maxAnchorExtent) {
            for(var j = min; j <= max; ++j) {
              targets.push(j);
            }
          } else {
            style = '" style="color:' + _.conf.ignoredAnchorColor;
          }

          return '<a href="' + link + style + '">' + all + '</a>';
        }
      );

      targets.sort();
      return '<span data-s2ch-num-ref="' + targets.reduce(function(a, b) {
        if (a[a.length - 1] !== b) {
          a.push(b);
        }
        return a;
      }, []).join(',') + '">' + html + '</span>';
    };

    var anchorPrefix = '(?:' + ['&gt;', '\uff1e', '\u226b'].join('|') + '){1,2}[\s\u3000]*',
        anchorSplitter = '(?:[,\uff0c=\uff1d\s\u3000]{1,2}(?:' + anchorPrefix + ')?|' + anchorPrefix + ')',
        anchorBase =
          '[\\d\uff10-\uff19]+' +
          '(?:-(?:' + anchorPrefix + ')?[\\d\uff10-\uff19]+)?' +
          '(?:' + anchorSplitter + '[\\d\uff10-\uff19]+' +
          '(?:-(?:' + anchorPrefix + ')?[\\d\uff10-\uff19]+)?)*',
        bodyAnchor = anchorPrefix + anchorBase;

    var id = '(?:[a-zA-Z\\d\\/\\.\\+]{8})(?:_[a-zA-Z\\d\\/\\.\\+]{8}){0,2}[a-zA-Z\\d]?';

    return {
      nameAnchor: [
        new RegExp('^(?:' + anchorPrefix + ')?' + anchorBase + '$'),
        composeAnchor
      ],

      bodyAnchor: [
        new RegExp(bodyAnchor),
        composeAnchor
      ],

      delATagAnchor: [
        new RegExp('<[aA][^>]*>(' + bodyAnchor + ')<\\/[aA]>', 'g'),
        '$1'
      ],

      headerID: [
        new RegExp('(\\s)(ID:(' + id + ')|\\[ (' + id + ') \\])'),
        '$1<span class="s2ch-id" data-s2ch-id="$3$4">$2</span>'
      ],

      bodyID: [
        new RegExp('(^|\\W)(ID:(' + id + '))(?![\\w\\/\\.+])', 'g'),
        '$1<span class="s2ch-id" data-s2ch-id-ref="$3">$2</span>'
      ],

      anchorExtractor: new RegExp(
        '.*?([\\d\uff10-\uff19]+)(?:-(?:' + anchorPrefix + ')?([\\d\uff10-\uff19]+))?',
        'g'
      )
    };
  })();

  // color index
  _.color = (function() {
    var color = {};

    ['num', 'id'].forEach(function(group) {
      var table = _.conf.color[group];

      color[group] = function(count) {
        var c = count;
        while(!(color = table[c--])) ;
        table[count] = color;
        return color;
      };
    });

    return color;
  })();

  _.Response = function(thread, number, numberAnchor, dt, dd) {
    this.thread = thread;
    this.number = number;
    this.numberAnchor = numberAnchor;
    this.dt = dt;
    this.dd = dd;
    this.reverseReferences = [];

    this.resolveReferences();

    this.numberAnchor.setAttribute('data-s2ch-thread-id', thread.id);

    this.idAnchor = this.dt.querySelector('*[data-s2ch-id]');
    if (this.idAnchor) {
      this.idAnchor.setAttribute('data-s2ch-thread-id', thread.id);
      this.id = this.idAnchor.getAttribute('data-s2ch-id');
    }
  };

  _.Response.prototype = {
    eachQuery: function(query, callback) {
      Array.prototype.forEach.call(this.dt.querySelectorAll(query), callback);
      Array.prototype.forEach.call(this.dd.querySelectorAll(query), callback);
    },

    resolveReferences: function() {
      this.numberReferences = [];
      this.idAnchors = [];

      var that = this, added = {};

      this.eachQuery('*[data-s2ch-num-ref]', function(elem) {
        elem.setAttribute('data-s2ch-thread-id', that.thread.id);

        elem.getAttribute('data-s2ch-num-ref').split(',').forEach(function(num) {
          num = parseInt(num);

          // 重複/未来/自己アンカー無視
          if (added[num] || num >= that.number) {
            return;
          }

          that.numberReferences.push(num);
          added[num] = true;
        });
      });

      this.eachQuery('*[data-s2ch-id-ref]', function(elem) {
        elem.setAttribute('data-s2ch-thread-id', that.thread.id);
        that.idAnchors.push(elem);
      });

      this.numberReferences.sort();
    },

    jump: function() {
      _.lazyScroll([this.dt, this.dd]);
      _.Popup.closeAll();
    }
  };

  _.Thread = function(dl) {
    this.id = ++_.Thread.idSeed || (_.Thread.idSeed = 1);
    (_.Thread.idMap || (_.Thread.idMap = {}))[this.id] = this;

    this.dl = dl;
    this.dl.classList.add('s2ch-thread');

    this.modifyHTML();
    this.setupItems();
    this.resolveReferences();
  };

  _.Thread.modifyItemHeader = function(html) {
    // a,b以外のタグ削除
    html = html.replace(/<(?!\/?(?:b|a)[ >])\/?[^>]*>/ig, '');

    // 最初の数字アンカー化。先頭一致にしないのは、レス番に<a name="レス番">を仕込んでるところがあるから。
    html = html
      .replace(/(^|>)[\s\u3000]*(\d+)/, function(all, prefix, num) {
        return prefix + '<a href="' + _.basepathHTML + num +
          '" data-s2ch-num="' + num + '">' + num + '</a>';
      })
      .replace(_.re.headerID[0], _.re.headerID[1]);

    // メール抽出 / メールアンカー削除
    html = html.replace(/(<a[^>]+?href=([\"\']))[^\2]*\/mailto:/i, '$1mailto:');

    var mail = '', mailfound = false;
    html = html.replace(
        /<a[^>]+?href=([\"\'])mailto:([^\1>]*)\1[^>]*>(.*?)<\/a>/i,
      function(all, d, m, c) {
        mailfound = true;
        mail = m;
        return c;
      }
    );

    // 名前 / 最初の太字部分を抜いてるのはアンカー化用
    html = html.replace(
        /(<b>[\s\u3000]*)([^<]*?)([\s\u3000]*<\/b>(?:.*<\/b>)?)(?:[\s\u3000]*\[(.*?)\])?/i,
      function(all, a, name, trip, m) {
        name = name.replace(_.re.nameAnchor[0], _.re.nameAnchor[1]);
        return '<span class="s2ch-res-name">' + a + name + trip + '</span>' +
          ' [<span class="s2ch-res-mail">' + (mail || m || '') + '</span>]';
      }
    );

    return html;
  };

  _.Thread.modifyItemBody = function(html) {
    html = html
      .replace(_.re.delATagAnchor[0], _.re.delATagAnchor[1])
      .replace(
          /<a(?=\s)[^>]*\shref=([\"\'])([^\1>]*)\1[^>]*>((?:ftp|sssp|h?t?tps?):\/\/([^<]*))<\/a>/ig,
        function(all, _quot, href, text, url) {
          // ime.nu とか外す
          try {
            href = decodeURIComponent(href);
            url  = decodeURIComponent(url);
          } catch(e) { }
          return href.indexOf(url) < 0 ? all : text;
        }
      );

    var terms = html.split(/(<[^>]*>)/);
    for(var i = 0; i < terms.length; i += 2) {
      if (i < 1 || !/<a\s/i.test(terms[i - 1])) {
        // 自動リンク
        terms[i] = terms[i].replace(
            /(^|\W)(ftp|sssp|h?t?tps?)(:\/\/(?:[a-z\d\.\-+_:\/\?%#=~@;\(\)\$,!\']|&amp;)*)/ig,
          function(_all, prefix, scheme, url) {
            var scheme_link = scheme;
            if (/^(?:sssp|h?t?tps?)$/i.test(scheme)) {
              scheme_link = 'http';
            }
            return prefix + '<a href="' + scheme_link + url + '">' + scheme + url + '</a>';
          }
        );
      }

      // アンカー
      terms[i] = terms[i].replace(_.re.bodyAnchor[0], _.re.bodyAnchor[1]);

      // ID:
      terms[i] = terms[i].replace(_.re.bodyID[0], _.re.bodyID[1]);
    }

    return terms.join('');
  };

  _.Thread.prototype = {
    eachDtDd: function(cb) {
      Array.prototype.forEach.call(this.dl.getElementsByTagName('dt'), function(dt) {
        var dd = dt.nextElementSibling;
        if (!dd || !/^dd$/i.test(dd.tagName)) {
          return;
        }
        cb(dt, dd);
      });
    },

    modifyHTML: function() {
      var that = this, html = '';
      this.eachDtDd(function(dt, dd) {
        html += '<dt>' + _.Thread.modifyItemHeader(dt.innerHTML) + '</dt>' +
          '<dd>' + _.Thread.modifyItemBody(dd.innerHTML) + '</dd>';
      });
      html = html.replace(/<script(?: [^>]*)?>[\s\S]*?<\/script>/ig, '');
      this.dl.innerHTML = html;
    },

    setupItems: function() {
      var that = this;
      this.items = [];
      this.numberMap = {};
      this.idMap = {};
      this.eachDtDd(function(dt, dd) {
        var num_a = dt.querySelector('a[data-s2ch-num]');
        if (!num_a) {
          return;
        }

        var num = parseInt(num_a.getAttribute('data-s2ch-num'));
        if (that.numberMap[num]) {
          return;
        }

        var item = new _.Response(that, num, num_a, dt, dd);
        that.items.push(item);
        that.numberMap[num] = item;
        if (item.id) {
          if (that.idMap[item.id]) {
            that.idMap[item.id].push(item);
          } else {
            that.idMap[item.id] = [item];
          }
        }
      });
    },

    resolveReferences: function() {
      var that = this;
      this.items.forEach(function(item) {
        item.numberReferences.forEach(function(ref) {
          ref = that.numberMap[ref];
          if (ref) {
            ref.reverseReferences.push(item);
          }
        });
      });

      this.items.forEach(function(item) {
        var color;

        item.numberAnchor.style.color = _.color.num(item.reverseReferences.length);

        if (item.id && item.idAnchor && that.idMap[item.id]) {
          item.idAnchor.style.color = _.color.id(that.idMap[item.id].length);
        }

        item.idAnchors.forEach(function(elem) {
          var id = elem.getAttribute('data-s2ch-id-ref');
          elem.style.color = _.color.id(that.idMap[id] ? that.idMap[id].length : 0);
        });
      });
    }
  };

  _.Thread.referenceFilter = [
    {
      attrs: ['data-s2ch-num'],
      handler: function(thread, num, attr) {
        num = parseInt(num);

        var item = thread.numberMap[num];
        if (!item || item.reverseReferences.length <= 0) {
          return null;
        }

        return {
          items: item.reverseReferences,
          tree: function(item) {
            return item.reverseReferences;
          },
          title: '\u62bd\u51fa \u88ab\u53c2\u7167\u30ec\u30b9: ' + num
        };
      }

    }, {
      attrs: ['data-s2ch-num-ref'],
      handler: function(thread, targets) {
        var items = [];

        targets.split(',').forEach(function(num) {
          var item = thread.numberMap[parseInt(num)];
          if (item) {
            items.push(item);
          }
        });

        return {
          items: items
        };
      }

    }, {
      attrs: ['data-s2ch-id', 'data-s2ch-id-ref'],
      handler: function(thread, id, attr) {
        var items = thread.idMap[id];

        if (!items) {
          return null;
        }

        if (attr === 'data-s2ch-id' && items.length <= 0) {
          return null;
        }

        return {
          items: items,
          title: '\u62bd\u51fa ID:' + id
        };
      }
    }
  ];

  _.Thread.onMouseOver = function(ev) {
    var source = ev.target, root;

    while(source && source.nodeType === window.Node.ELEMENT_NODE) {
      _.Thread.referenceFilter.forEach(function(filter) {
        if (root) {
          return;
        }

        filter.attrs.forEach(function(attr) {
          if (root || !source.hasAttribute(attr)) {
            return;
          }

          var thread = _.Thread.idMap[parseInt(source.getAttribute('data-s2ch-thread-id'))];
          if (!thread) {
            return;
          }

          var data = filter.handler(thread, source.getAttribute(attr), attr);
          if (!data) {
            return;
          }

          if (data.items.length <= 0) {
            data.title = '\u5bfe\u8c61\u30ec\u30b9\u304c\u3042\u308a\u307e\u305b\u3093';
          }

          if (!root) {
            root = document.createElement('div');
          }

          if (data.items.length <= 0) {
            return;
          }

          var count = _.conf.popup.maxResCount,
              depth = _.conf.popup.maxTreeDepth,
              leaf  = data.items.map(function(item) {
                return [item, null];
              });

          var dl;
          while(count > 0 && leaf.length > 0 && depth-- > 0) {
            var omit = [];

            leaf = leaf.reduce(function(new_leaf, pair) {
              if (count <= 0) {
                omit.push(pair[0]);
                return new_leaf;
              }

              var item       = pair[0],
                  parentElem = pair[1],
                  dd;

              if (!dl || (parentElem && dl.parentNode !== parentElem)) {
                dl = document.createElement('dl');
                if (parentElem) {
                  parentElem.appendChild(dl);
                } else {
                  root.appendChild(dl);
                }
              }

              dl.appendChild(item.dt.cloneNode(true));
              dl.appendChild(dd = item.dd.cloneNode(true));

              item.reverseReferences.forEach(function(item) {
                new_leaf.push([item, dd]);
              });

              --count;
              return new_leaf;
            }, []);

            if (omit.length > 0) {
              var dt = document.createElement('dt');
              dt.classList.add('s2ch-omit-link');
              dt.textContent = '... ' + omit.length + ' \u30ec\u30b9\u7701\u7565 (\u30af\u30ea\u30c3\u30af\u3067\u5c55\u958b) ...';
              dt.addEventListener('click', function(ev) {
                var first;
                dt.parentNode.removeChild(dt);
                omit.forEach(function(item) {
                  var dt, dd;
                  dl.appendChild(dt = item.dt.cloneNode(true));
                  dl.appendChild(dd = item.dd.cloneNode(true));
                  first = [dt, dd];
                });
                _.lazyScroll(first);
              }, false);
              dl.appendChild(dt);
            }
          }

          if (data.title) {
            var title = document.createElement('div');
            title.className = 's2ch-popup-title';
            title.textContent = data.title;
            root.insertBefore(title, root.firstChild);
          }
        });
      });

      if (root) {
        break;
      }

      source = source.parentNode;
    }

    if (root) {
      _.Popup.run(source, root);
      return;
    }

    if (ev.target instanceof window.HTMLAnchorElement) {
      var url = ev.target.textContent, dec = url;
      try {
        dec = decodeURIComponent(url);
      } catch(ex) {}
      if (url !== dec) {
        root = document.createElement('div');
        root.textContent = dec;
        _.Popup.run(ev.target, root, -1);
      }
    }
  };

  _.Thread.onClickHandlers = [
    {
      attrs: ['data-s2ch-num-ref'],
      handler: function(thread, ref) {
        var num = parseInt(ref.split(',')[0]);
        if (thread.numberMap[num]) {
          thread.numberMap[num].jump();
          return true;
        }
        return false;
      }
    }
  ];

  _.Thread.onClick = function(ev) {
    if (ev.button !== 0 || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.metaKey) {
      return;
    }

    var elem = ev.target, end = false;

    while(!end && elem && elem.nodeType === window.Node.ELEMENT_NODE) {
      var id;

      _.Thread.onClickHandlers.forEach(function(entry) {
        if (end) {
          return;
        }

        var thread, value = entry.attrs.reduce(function(prev, curr) {
          return prev || elem.getAttribute(curr);
        }, null);

        if (value) {
          if (elem.hasAttribute('data-s2ch-thread-id')) {
            thread = _.Thread.idMap[parseInt(elem.getAttribute('data-s2ch-thread-id'))];
          } else {
            return;
          }

          if (entry.handler(thread, value)) {
            ev.preventDefault();
          }
          end = true;
        }
      });

      elem = elem.parentNode;
    }
  };

  _.Thread.init = function() {
    window.addEventListener('mouseover', _.Thread.onMouseOver, false);
    window.addEventListener('click', _.Thread.onClick, false);
  };

  _.Popup = function(root, source) {
    this.source = source;
    this.root = document.createElement('div');
    this.root.className = 's2ch-popup';
    this.root.appendChild(root);

    var that = this;

    this.root.addEventListener('mousewheel', function(ev) {
      if (that.root.scrollWidth > that.root.clientWidth) {
        var left  = that.root.scrollLeft === 0,
            right = that.root.scrollLeft + that.root.clientWidth >= that.root.scrollWidth;
        if ((ev.wheelDeltaX > 0 && left) || (ev.wheelDeltaX < 0 && right)) {
          ev.preventDefault();
          return;
        }
      }

      if (that.root.scrollHeight > that.root.clientHeight) {
        var top    = that.root.scrollTop === 0,
            bottom = that.root.scrollTop + that.root.clientHeight >= that.root.scrollHeight;
        if ((ev.wheelDeltaY > 0 && top) || (ev.wheelDeltaY < 0 && bottom)) {
          ev.preventDefault();
          return;
        }
      }
    }, false);

    this.root.addEventListener('mousedown', function(ev) {
      if (ev.detail === 2) {
        ev.preventDefault();
        that.close();
      }
    }, false);
  };

  _.Popup.prototype = {
    show: function(pinTime) {
      var that = this;

      document.body.appendChild(this.root);
      this.adjustLocation();

      if (pinTime === 0) {
        this.pin();
      } else if (pinTime > 0) {
        window.setTimeout(function() {
          that.pin();
        }, pinTime);
      }
    },

    pin: function() {
      this.pinned = true;
      this.root.classList.add('s2ch-popup-pinned');
    },

    adjustLocation: function() {
      var screen       = document.compatMode === 'BackCompat' ? document.body : document.documentElement,
          screenWidth  = screen.clientWidth,
          screenHeight = screen.clientHeight,
          sourceRect   = this.source.getBoundingClientRect(),
          width        = this.root.offsetWidth,
          height       = this.root.offsetHeight,
          left, top;

      if (height <= sourceRect.top) {
        left = sourceRect.left;
        top  = sourceRect.top - height;

      } else if (width <= screenWidth - sourceRect.right) {
        left = sourceRect.right;
        top  = sourceRect.bottom - height;

      } else if (width <= sourceRect.left) {
        left = sourceRect.left - width;
        top  = sourceRect.bottom - height;

      } else if (height <= screenHeight - sourceRect.bottom) {
        left = sourceRect.left;
        top  = sourceRect.bottom;

      } else {
        left = screenWidth - width;
        top  = 0;
      }

      left = Math.max(0, Math.min(left, screen.clientWidth  - width));
      top  = Math.max(0, Math.min(top,  screen.clientHeight - height));

      if (left + width > screenWidth) {
        this.root.style.width = (screenWidth - left) + 'px';
      } else {
        this.root.style.width = '';
      }

      if (top + height > screenHeight) {
        this.root.style.height = (screenHeight - top) + 'px';
      } else {
        this.root.style.height = '';
      }

      this.root.style.left = (left + screen.scrollLeft) + 'px';
      this.root.style.top  = (top  + screen.scrollTop)  + 'px';
    },

    setParent: function(parent) {
      this.parent = parent;
    },

    addChild: function(popup) {
      if (this.child) {
        this.child.close();
      }
      this.child = popup;
      popup.setParent(this);
    },

    removeChild: function(popup) {
      if (popup === this.child) {
        delete(this.child);
      }
    },

    close: function() {
      if (this.child) {
        this.child.close();
      }
      this.root.parentNode.removeChild(this.root);
      if (this === _.Popup.leaf) {
        _.Popup.leaf = this.parent;
      }
      if (this === _.Popup.root) {
        _.Popup.root = null;
      }
      if (this.parent) {
        this.parent.removeChild(this);
      }
    },

    checkClose: function(pos, prev) {
      var popupRect  = this.root.getBoundingClientRect(),
          sourceRect = this.source.getBoundingClientRect();

      if (pos.x >= sourceRect.left && pos.x <= sourceRect.right &&
          pos.y >= sourceRect.top  && pos.y <= sourceRect.bottom) {
        return;
      }

      if (!this.pinned ||
          (pos.x < popupRect.left   && pos.x < prev.x) ||
          (pos.x > popupRect.right  && pos.x > prev.x) ||
          (pos.y < popupRect.top    && pos.y < prev.y) ||
          (pos.y > popupRect.bottom && pos.y > prev.y)) {
        this.close();
        if (this.parent) {
          this.parent.checkClose(pos, prev);
        }
        return;
      }
    }
  };

  _.Popup.run = function(source, root, pinTime) {
    var popup = _.Popup.leaf;
    while(popup) {
      if (source === popup.source) {
        return null;
      }
      popup = popup.parent;
    }

    var popupRoot = source;
    while((popupRoot = popupRoot.parentNode) && popupRoot.nodeType === window.Node.ELEMENT_NODE) {
      if (popupRoot.classList.contains('s2ch-popup')) {
        break;
      }
    }

    if (popupRoot) {
      while(_.Popup.leaf && _.Popup.leaf.root !== popupRoot) {
        _.Popup.leaf.close();
      }
    }

    popup = new _.Popup(root, source);
    popup.show(pinTime || _.conf.popup.pinTime);
    if (!_.Popup.root) {
      _.Popup.root = popup;
    }
    if (_.Popup.leaf) {
      _.Popup.leaf.addChild(popup);
    }
    _.Popup.leaf = popup;
    return popup;
  };

  _.Popup.closeAll = function() {
    if (_.Popup.root) {
      _.Popup.root.close();
    }
  };

  _.Popup.onMouseMove = function(ev) {
    var pos = {
      x: ev.clientX,
      y: ev.clientY
    };

    if (_.Popup.leaf && _.Popup.lastMousePos) {
      _.Popup.leaf.checkClose(pos, _.Popup.lastMousePos);
    }

    _.Popup.lastMousePos = pos;
  };

  _.Popup.init = function() {
    window.addEventListener('mousemove', _.Popup.onMouseMove, false);
  };

  _.run = function() {
    var time_s, time_e;

    window.console.log('super2ch: start');

    time_s = Date.now();

    _.threadList = [];
    Array.prototype.forEach.call(document.querySelectorAll('dl.thread'), function(dl) {
      _.threadList.push(new _.Thread(dl));
    });

    if (_.threadList.length === 0) {
      var dl = Array.prototype.map.call(document.getElementsByTagName('dl'), function(dl) {
        return [dl, dl.offsetWidth * dl.offsetHeight];
      }).sort(function(a, b) {
        return b[1] - a[1];
      })[0];
      if (dl) {
        _.threadList.push(new _.Thread(dl[0]));
      }
    }

    if (_.threadList.length) {
      document.body.classList.add('super2ch');

      var style = document.createElement('style');
      style.textContent = _.css;
      document.body.appendChild(style);
    }

    _.Thread.init();
    _.Popup.init();

    time_e = Date.now();
    window.console.log('super2ch: done ' + ((time_e - time_s) / 1000) + 's');
  };

  _.lazyScroll = function(elements) {
    var screen, screenHeight, scroll, top, bottom, offset = 0;

    for(var p = elements[0].parentNode; p && p.nodeType === window.Node.ELEMENT_NODE; p = p.parentNode) {
      if (p.scrollHeight > p.offsetHeight) {
        screen = scroll = p;
        break;
      }
    }

    if (!screen) {
      screen = document.compatMode === 'BackCompat' ? document.body : document.documentElement;
    }
    screenHeight = screen.clientHeight;

    elements.forEach(function(elem) {
      var rect = elem.getBoundingClientRect();
      if (typeof(top) === 'undefined' || rect.top < top) {
        top = rect.top;
      }
      if (typeof(bottom) === 'undefined' || rect.bottom > bottom) {
        bottom = rect.bottom;
      }
    });

    if (top < screenHeight * 0.2) {
      offset = top - screenHeight * 0.2;
    } else if (bottom > screenHeight * 0.8) {
      offset = bottom - screenHeight * 0.8;
    }

    if (offset) {
      if (!scroll) {
        document.body.scrollTop += offset;
        scroll = document.documentElement;
      }
      scroll.scrollTop += offset;
    }
  };

  _.css = [
    'body.super2ch .s2ch-id{',
    '  text-decoration:underline;',
    '  cursor:pointer;',
    '}',
    'body.super2ch .s2ch-popup{',
    '   position:absolute;',
    '   border:outset 1px gray;',
    '   padding:3px;',
    '   background-color:#f0ffff;',
    '   color:#000;',
    '   font-size:smaller;',
    '   max-width:100%;',
    '   max-height:100%;',
    '   overflow:auto;',
    '   box-sizing:border-box;',
    '   -moz-box-sizing:border-box;',
    '   -webkit-box-sizing:border-box;',
    '   z-index:32767;',
    '}',
    'body.super2ch .s2ch-popup-pinned{',
    '  background-color:#ffffe0;',
    '}',
    'body.super2ch .s2ch-popup dl{',
    '  margin:0px;',
    '  padding:0px;',
    '}',
    'body.super2ch .s2ch-popup dl dd{',
    '  margin:0px 0px 0px 2em;',
    '}',
    'body.super2ch .s2ch-popup dl dd dl{',
    '  border-left:3px solid #ccc;',
    '  padding-left:4px;',
    '}',
    'body.super2ch .s2ch-popup .s2ch-popup-title + *{',
    '  margin-top:1em;',
    '}',
    'body.super2ch .s2ch-res-name{',
    '  color:#804040;',
    '}',
    'body.super2ch .s2ch-res-name > b{',
    '  color:green;',
    '}',
    'body.super2ch .s2ch-popup img{',
    '  max-width:320px;',
    '  max-height:240px;',
    '}',
    'body.super2ch .s2ch-omit-link{',
    '  color:#888;',
    '  text-decoration:underline;',
    '  cursor:pointer;',
    '  padding-bottom:0.2em',
    '}'
  ].join('');

  _.run();
});
