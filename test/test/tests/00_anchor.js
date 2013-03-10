(function(test) {

  test.html.head([
    ['1',
     '<a href="1" data-s2ch-num="1">1</a>'],

    ['<a href="mailto:sage"><b>hoge</b></a>',
     '<span class="s2ch-res-name"><b>hoge</b></span> [<span class="s2ch-res-mail">sage</span>]'],

    ['ID:00000000',
     'ID:00000000'],

    [' ID:0000000',
     ' ID:0000000'],

    [' ID:00000000',
     ' <span class="s2ch-id" data-s2ch-id="00000000">ID:00000000</span>'],

    [' ID:000000000',
     ' <span class="s2ch-id" data-s2ch-id="000000000">ID:000000000</span>'],

    [' ID:0000000000',
     ' <span class="s2ch-id" data-s2ch-id="000000000">ID:000000000</span>0'],

    ['<b>hoge</b>[sage]',
     '<span class="s2ch-res-name"><b>hoge</b></span> [<span class="s2ch-res-mail">sage</span>]'],

    ['1<b>&gt;&gt;1,2,3-5,6=8</b>',
     '<a href="1" data-s2ch-num="1">1</a><span class="s2ch-res-name"><b><span data-s2ch-num-ref="1,2,3,4,5,6,8"><a href="1">&gt;&gt;1</a><a href="2">,2</a><a href="3-5">,3-5</a><a href="6">,6</a><a href="8">=8</a></span></b></span> [<span class="s2ch-res-mail"></span>]'],

    ['1<b>1,2,3-5,6=8</b>',
     '<a href="1" data-s2ch-num="1">1</a><span class="s2ch-res-name"><b><span data-s2ch-num-ref="1,2,3,4,5,6,8"><a href="1">1</a><a href="2">,2</a><a href="3-5">,3-5</a><a href="6">,6</a><a href="8">=8</a></span></b></span> [<span class="s2ch-res-mail"></span>]']
  ]);

})(this.window.super2ch.test);
