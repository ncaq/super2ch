PHANTOMJS_NAME = phantomjs-1.8.2-linux-i686
PHANTOMJS_BIN  = $(CURDIR)/$(PHANTOMJS_NAME)/bin/phantomjs
PHANTOMJS_TAR  = $(CURDIR)/$(PHANTOMJS_NAME).tar.bz2

all: run

run: $(PHANTOMJS_BIN)
	cd test && $(PHANTOMJS_BIN) main.js

$(PHANTOMJS_BIN): $(PHANTOMJS_TAR)
	rm -rf $(PHANTOMJS_NAME)
	tar xf $(PHANTOMJS_TAR)
	touch $(PHANTOMJS_BIN)

$(PHANTOMJS_TAR):
	curl -O http://phantomjs.googlecode.com/files/$@
