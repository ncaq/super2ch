// ==UserScript==
// @name        super2ch
// @version     3.0
// @author      wowo
// @license     The MIT License
// @namespace   http://my.opera.com/crckyl/
// @include     http://*
// ==/UserScript==

(function(super2ch) {
  if (window !== window.top) {
    return;
  }

  var conf = {
    // maxAnchorExtent 以上の範囲アンカーは無視する
    // >>1-1000 のようなアンカーが被参照ポップアップに現れなくなる
    maxAnchorExtent:    32,
    ignoredAnchorColor: '#666',

    color: {
      num: { // レス番ハイライト
        0: '#00f',
        1: '#808',
        3: '#f00'
      },

      id: { // IDハイライト
        0: '#000',
        2: '#00f',
        5: '#f00'
      }
    },

    popup: {
      // ポップアップが固定されるまでの時間(ミリ秒)
      // ポップアップを表示してから pinTime 以内にカーソルがアンカーから離れるとポップアップを消す
      // 0 なら待たずに固定する
      pinTime:     100,
      // 一つのポップアップには maxResCount 個までしかレスを表示しない
      maxResCount: 20
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

  if (run) {
    super2ch({
      conf: conf
    });
  }

})(function(_) {
  _.re = {
    anchorPrefix:   '(?:' + ['&gt;', '\uff1e', '\u226b'].join('|') + '){1,2}[\s\u3000]*',
    anchorSplitter: '[,\uff0c=\uff1d\s\u3000]{1,2}',
    id:             '(?:[a-zA-Z\\d\\/\\.\\+]{8})(?:_[a-zA-Z\\d\\/\\.\\+]{8}){0,2}[a-zA-Z\\d]?'
  };

  _.re.anchorBase = 
    '[\\d\uff10-\uff19]+' +
    '(?:-(?:' + _.re.anchorPrefix + ')?[\\d\uff10-\uff19]+)?' +
    '(?:' + _.re.anchorSplitter + '(?:' + _.re.anchorPrefix + ')?[\\d\uff10-\uff19]+' +
    '(?:-(?:' + _.re.anchorPrefix + ')?[\\d\uff10-\uff19]+)?)*';

  _.re.nameAnchor = new RegExp('^(?:' + _.re.anchorPrefix + ')?' + _.re.anchorBase + '$');

  _.re.bodyAnchor = new RegExp(_.re.anchorPrefix + _.re.anchorBase);

  _.re.headerID = [
    new RegExp('(\\s)(ID:(' + _.re.id + ')|\\[ (' + _.re.id + ') \\])'),
    '$1<span class="s2ch-id" data-s2ch-id="$3$4">$2</span>'
  ];

  _.re.bodyID = [
    new RegExp('(^|\\W)(ID:(' + _.re.id + '))(?![\\w\\/\\.+])', 'g'),
    '$1<span class="s2ch-id" data-s2ch-id-ref="$3">$2</span>'
  ];

  _.re.delATagAnchor = [new RegExp('<[aA][^>]*>(' + _.re.bodyAnchor.source + ')<\\/[aA]>', 'g'), '$1'];

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
      var that         = this,
          top          = this.dt.getBoundingClientRect().top,
          bottom       = this.dd.getBoundingClientRect().bottom,
          screenHeight = document.documentElement.clientHeight,
          offset       = 0;

      if (top < screenHeight * 0.2) {
        offset = top - screenHeight * 0.2;
      } else if (bottom > screenHeight * 0.8) {
        offset = bottom - screenHeight * 0.8;
      }

      document.documentElement.scrollTop += offset;
      document.body.scrollTop += offset;
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
        html += '<dt>' + that.modifyItemHeader(dt.innerHTML) + '</dt>' +
          '<dd>' + that.modifyItemBody(dd.innerHTML) + '</dd>';
      });
      html = html.replace(/<script(?: [^>]*)?>[\s\S]*?<\/script>/ig, '');
      this.dl.innerHTML = html;
    },

    parseAnchor: function(str) {
      var that = this, html, targets = [];

      html = str.replace(
          /.*?(([\d\uff10-\uff19]+)(?:-([\d\uff10-\uff19]+))?)/g,
        function(all, target, min, max) {
          var style = '';

          min = parseInt(_.toAscii(min));
          max = max ? parseInt(_.toAscii(max)) : min;

          if (max < min) {
            var tmp = min;
            min = max;
            max = tmp;
          }

          if (max - min + 1 <= _.conf.maxAnchorExtent) {
            for(var j = min; j <= max; ++j) {
              targets.push(j);
            }
          } else {
            style = '" style="color:' + _.conf.ignoredAnchorColor;
          }

          return '<a href="' + _.toAscii(target) + style + '">' + all + '</a>';
        }
      );

      targets.sort();
      return '<span data-s2ch-num-ref="' + targets.reduce(function(a, b) {
        if (a[a.length - 1] !== b) {
          a.push(b);
        }
        return a;
      }, []).join(',') + '">' + html + '</span>';
    },

    modifyItemHeader: function(html) {
      var that = this;

      // a,b以外のタグ削除
      html = html.replace(/<(?!\/?(?:b|a)[ >])\/?[^>]*>/ig, '');

      // 最初の数字アンカー化。先頭一致にしないのは、レス番に<a name="レス番">を仕込んでるところがあるから。
      html = html
        .replace(/(^|>)[\s\u3000]*(\d+)/, function(all, prefix, num) {
          return prefix + '<a href="' + num + '" data-s2ch-num="' + num + '">' + num + '</a>';
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
          /(<b>[\s\u3000]*)([^<]*?)([\s\u3000]*<\/b>(?:.*<\/b>)?)( *\[(.*?)\])?/i,
        function(all, a, name, b, mc, m) {
          name = name.replace(_.re.nameAnchor, that.parseAnchor);
          return '<span class="s2ch-res-name">' + a + name + b + '</b></span>' +
            (mailfound ? '[' + mail + ']' : (mc ? '[' + m + ']' : '[]'));
        }
      );

      return html;
    },

    modifyItemBody: function(html) {
      var that = this;

      html = html
        .replace(_.re.delATagAnchor[0], _.re.delATagAnchor[1])
        .replace(
            /<a(?=\s)[^>]*\shref=([\"\'])([^\1>]*)\1[^>]*>((?:ftp|sssp|h?t?tps?):\/\/([^<]*))<\/a>/ig,
          function(all, _quot, href, text, url) {
            try {
              href = decodeURIComponent(href);
              url  = decodeURIComponent(url);
            } catch(e) {}
            return href.indexOf(url) == -1 ? all : text;
          }
        );

      // タグとテキストを分離
      // splitに渡す正規表現を()で囲むとスプリッタも配列に含まれる
      var terms = html.split(/(<[^>]*>)/);
      for(var i = 0; i < terms.length; i += 2) {
        /* 保管庫系の板でスレッドURLのリンク先をサイト内の物に書き換えてる場合を
         * 考慮して直前のタグがアンカーでない場合のみURLをリンク化
         * terms[i]内にタグがないのは保証済みのため、誤爆する可能性があるとすれば
         * <a href="http://a/">pre<small>http://b/</small>post</a>
         * なんて事になってる場合だが、この場合は
         * <a href="http://a/">pre</a><small><a href="http://b/">http://b/</a></small>post
         * と展開されるはずなので、たぶん影響はあんまりない
         */

        if (i < 1 || !terms[i - 1].match(/<a\s/i)) {
          terms[i] = terms[i].replace(
              /(^|\W)(ftp|sssp|h?t?tps?)(:\/\/[a-z\d\.\-+_:\/&\?%#=~@;\(\)\$,!\']*)/ig,
            function(_dummy, prefix, scheme, url) {
              var scheme_link = scheme;
              if (/^(?:sssp|h?t?tps?)$/i.test(scheme)) {
                scheme_link = 'http';
              }
              return prefix + '<a href="' + scheme_link + url + '">' + scheme + url + '</a>';
            }
          );
        }

        // アンカー
        terms[i] = terms[i].replace(_.re.bodyAnchor, function(str) {
          return that.parseAnchor(str);
        });
        // ID:
        terms[i] = terms[i].replace(_.re.bodyID[0], _.re.bodyID[1]);
      }

      return terms.join('');
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
          if (!that.idMap[item.id]) {
            that.idMap[item.id] = [item];
          } else {
            that.idMap[item.id].push(item);
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
        var cnt, color;

        cnt = item.reverseReferences.length;
        while(!(color = _.conf.color.num[cnt--])) ;
        item.numberAnchor.style.color = color;

        if (item.id && that.idMap[item.id] && item.idAnchor) {
          cnt = that.idMap[item.id].length;
          while(!(color = _.conf.color.id[cnt--])) ;
          item.idAnchor.style.color = color;
        }

        item.idAnchors.forEach(function(elem) {
          var id = elem.getAttribute('data-s2ch-id-ref');
          cnt = that.idMap[item.id].length;
          while(!(color = _.conf.color.id[cnt--])) ;
          elem.style.color = color;
        });
      });
    }
  };

  _.Thread.referenceFilter = [
    {
      attrs: ['data-s2ch-num'],
      handler: function(thread, num) {
        num = parseInt(num);

        var item = thread.numberMap[num];
        if (!item || item.reverseReferences.length <= 0) {
          return null;
        }

        return {
          items: item.reverseReferences,
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

    while(source && source.hasAttribute) {
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
          if (data && data.items) {
            if (data.items.length <= 0) {
              data.title = '\u5bfe\u8c61\u30ec\u30b9\u304c\u3042\u308a\u307e\u305b\u3093';
            }

            if (data.items.length > _.conf.popup.maxResCount) {
              data.title = data.title ? data.title + ' ' : '';
              data.title += ' (' + _.conf.popup.maxResCount + '/' + data.items.length + ')';
              data.items = data.items.slice(0, _.conf.popup.maxResCount);
            }

            if (!root) {
              root = document.createElement('div');
            }

            if (data.title) {
              var title = document.createElement('div');
              title.className = 's2ch-popup-title';
              title.textContent = data.title;
              root.appendChild(title);
            }

            if (data.items.length > 0) {
              var dl = document.createElement('dl');
              dl.classList.add('s2ch-thread');
              data.items.forEach(function(item) {
                dl.appendChild(item.dt.cloneNode(true));
                dl.appendChild(item.dd.cloneNode(true));
              });
              root.appendChild(dl);
            }
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

  _.Thread.onClick = function(ev) {
    if (ev.button !== 0 || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.metaKey) {
      return;
    }

    var elem = ev.target;
    while(elem && elem.hasAttribute) {
      if (elem.hasAttribute('data-s2ch-num-ref')) {
        var thread = _.Thread.idMap[parseInt(elem.getAttribute('data-s2ch-thread-id'))],
            num    = parseInt(elem.getAttribute('data-s2ch-num-ref').split(',')[0]);
        if (thread && thread.numberMap[num]) {
          ev.preventDefault();
          thread.numberMap[num].jump();
        }
        break;
      }
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
      var screen     = document.documentElement,
          screenRect = screen.getBoundingClientRect(),
          sourceRect = this.source.getBoundingClientRect(),
          width      = this.root.offsetWidth,
          height     = this.root.offsetHeight,
          left,
          top;

      if (height <= sourceRect.top) {
        left = sourceRect.left;
        top  = sourceRect.top - height;

      } else if (width <= screen.clientWidth - sourceRect.right) {
        left = sourceRect.right;
        top  = sourceRect.bottom - height;

      } else if (width <= sourceRect.left) {
        left = sourceRect.left - width;
        top  = sourceRect.bottom - height;

      } else if (height <= screen.clientHeight - sourceRect.bottom) {
        left = sourceRect.left;
        top  = sourceRect.bottom;
      } else {
        left = screen.clientWidth - width;
        top  = 0;
      }

      left = Math.max(0, Math.min(left, screen.clientWidth  - width));
      top  = Math.max(0, Math.min(top,  screen.clientHeight - height));

      this.root.style.left = (left - screenRect.left) + 'px';
      this.root.style.top  = (top  - screenRect.top)  + 'px';
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
    var popupRoot = source;
    while((popupRoot = popupRoot.parentNode) && popupRoot.classList) {
      if (popupRoot.classList.contains('s2ch-popup')) {
        break;
      }
    }

    if (popupRoot) {
      while(_.Popup.leaf && _.Popup.leaf.root !== popupRoot) {
        _.Popup.leaf.close();
      }
    }

    var popup = new _.Popup(root, source);
    popup.show(pinTime || _.conf.popup.pinTime);
    if (_.Popup.leaf) {
      _.Popup.leaf.addChild(popup);
    }
    _.Popup.leaf = popup;
    return popup;
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

  _.toAscii = function(text) {
    return text.replace(/[\uff10-\uff19]/g, function(chr) {
      return String.fromCharCode(chr.charCodeAt(0) - 0xfee0);
    });
  };

  _.css = [
    'body.super2ch .s2ch-id{text-decoration:underline;cursor:pointer}',
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
    '   z-index:32767;',
    '}',
    'body.super2ch .s2ch-popup-pinned{background-color:#ffffe0}',
    'body.super2ch .s2ch-popup dl{margin:0px;padding:0px}',
    'body.super2ch .s2ch-popup .s2ch-popup-title + *{margin-top:1em}',
    'body.super2ch .s2ch-res-name{color:#804040}',
    'body.super2ch .s2ch-res-name>b{color:green}',
    'body.super2ch .s2ch-popup img{max-width:320px;max-height:240px}'
  ].join('');

  _.run();
});
