odoo.define('pos_bus_restaurant.screen_kitchen', function (require) {
    var screens = require('point_of_sale.screens');
    var gui = require('point_of_sale.gui');
    var core = require('web.core');
    var qweb = core.qweb;

    var KitchenScreen = screens.ScreenWidget.extend({
        template: 'kitchen_screen',
        show_numpad: false,
        show_leftpane: true,
        previous_screen: false,

        init: function (parent, options) {
            this.datas_render = [];
            this.line_by_string = "";
            this.line_by_product_name = {};
            this._super(parent, options);
        },
        start: function () {
            var self = this;
            this._super();
            self.reverse = false;
            this.pos.bind('reload:kitchen_screen', function () {
                self.renderElement()
            })
        },
        show: function () {
            var self = this;
            this._super();
        },
        product_url: function (product_id) {
            return window.location.origin + '/web/image?model=product.product&field=image_medium&id=' + product_id;
        },
        clear_search: function () {
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
            this.renderElement();
        },
        line_filter_by_string: function (line) {
            var str = line.product['display_name'];
            if (line.order.floor) {
                str += '|' + line.order.floor;
            }
            if (line.order.table) {
                str += '|' + line.order.table;
            }
            if (line.note) {
                str += '|' + line.note;
            }
            if (line.creation_time) {
                str += '|' + line.creation_time;
            }
            str = '' + line.product['display_name'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_line: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var query = this.line_by_string;
                var r = re.exec(this.line_by_string);
                if (r && r[1]) {
                    var product_name = r[1];
                    if (this.line_by_product_name[product_name] !== undefined) {
                        for (var i = 0; i < this.line_by_product_name[product_name].length; i++) {
                            results.push(this.line_by_product_name[product_name][i]);
                        }
                    } else {
                        var code = r
                    }
                } else {
                    break;
                }
            }
            return results;
        },
        get_data_items: function () {
            this.datas_render = [];
            var orders = this.pos.get('orders').models;
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                for (var j = 0; j < order.orderlines.models.length; j++) {
                    var curr_line = order.orderlines.models[j];
                    curr_line['product_url'] = this.product_url(curr_line['product']['id']);
                    var quantity_done = curr_line['quantity_done'];
                    var quantity = curr_line['quantity'];
                    if (quantity_done) {
                        curr_line['quantity_wait'] = quantity - quantity_done;
                    } else {
                        curr_line['quantity_wait'] = quantity;
                    }
                    this.datas_render.push(curr_line);
                }
            }
            this.datas_render = this.datas_render.sort(this.pos.sort_by('creation_time', false, function (a) {
                if (!a) {
                    a = 'N/A';
                }
                return a.toUpperCase()
            }));
        },
        renderElement: function (items) {
            var self = this;
            this._super();
            this.get_data_items();
            if (this.datas_render) {
                this.render_items();
                this.line_actions();
            }
            this.$('.back').click(function () {
                self.gui.back();
            });
            var search_timeout = null;
            if (this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard) {
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }
            this.$('.search-line input').on('keypress', function (event) {
                var query = this.value;
                clearTimeout(search_timeout);
                search_timeout = setTimeout(function () {
                    self.search_line(query);
                }, 100);
            });
            this.$('.search-line .search-clear').click(function () {
                self.clear_search();
            });
        },
        line_actions: function () {
            var self = this;
            this.$('.kitchen_delivery').click(function () {
                var line_uid = $(this).parent().parent().data()['id'];
                var curr_line = self.pos.get_line_by_uid(line_uid);
                if (!curr_line) {
                    console.log('line not found');
                } else {
                    curr_line.set_state('Waiting-delivery');
                }
                self.renderElement();
            });
            this.$('.kitchen_cancel').click(function () {
                var line_uid = $(this).parent().parent().data()['id'];
                var curr_line = self.pos.get_line_by_uid(line_uid);
                if (!curr_line) {
                    console.log('line not found');
                } else {
                    curr_line.set_state('Not-enough-material');
                }
                self.renderElement();
            });
            this.$('.kitchen_put_back').click(function () {
                var line_uid = $(this).parent().parent().data()['id'];
                var curr_line = self.pos.get_line_by_uid(line_uid);
                if (!curr_line) {
                    console.log('line not found');
                } else {
                    curr_line.set_state('Waiting');
                }
                self.renderElement();
            });
            this.$('.kitchen_confirm_cancel').click(function () {
                var line_uid = $(this).parent().parent().data()['id'];
                var curr_line = self.pos.get_line_by_uid(line_uid);
                if (!curr_line) {
                    console.log('line not found');
                } else {
                    curr_line.set_state('Kitchen Waiting cancel');
                }
                self.renderElement();
            });
        },
        render_items: function () {
            this.line_by_string = "";
            var items = this.datas_render;
            if (items.length == 0) {
                return;
            }
            for (i = 0; i < items.length; i++) {
                var item = items[i];
                this.line_by_string += this.line_filter_by_string(item)
                if (!this.line_by_product_name[item['product']['display_name']]) {
                    this.line_by_product_name[item['product']['display_name']] = [item];
                } else {
                    this.line_by_product_name[item['product']['display_name']].push(item);
                }
            }
            var number = 1;
            for (var i = 0; i < items.length; i++) {
                var line = items[i];
                var display = this.pos.db.is_product_in_category(this.pos.config.product_categ_ids, line.get_product().id); //  kiem tra xem san pham nằm trong danh mục đc hiển thị không
                if (!display && !this.pos.config.display_all_product) {
                    console.warn('product have category not the same kitchen/bar categories config');
                    continue;
                }
                if (['High-Priority', 'Waiting', 'Error'].indexOf(line.state) != -1) {
                    if (line.uom_id) {
                        var uom = this.pos.uom_by_id[line.uom_id]
                        if (uom) {
                            line['uom'] = uom;
                        }
                    } else {
                        var uom = this.pos.uom_by_id[line.product.uom_id[0]];
                        if (uom) {
                            line['uom'] = uom;
                        }
                    }
                    line['number'] = number;
                    number += 1;
                    var line_html = qweb.render('kitchen_line', {widget: this, line: line});
                    var line_cache = document.createElement('tbody');
                    line_cache.innerHTML = line_html;
                    line_cache = line_cache.childNodes[1];
                    if (line.state == 'High-Priority') {
                        this.$el[0].querySelector('.priority').appendChild(line_cache);
                    } else if (line.state == 'Error') {
                        this.$el[0].querySelector('.error').appendChild(line_cache);
                    } else if (line.state == 'Waiting') {
                        this.$el[0].querySelector('.waiting').appendChild(line_cache);
                    }// else if (line.state == 'Waiting-delivery') {
                    //     this.$el[0].querySelector('.waiting-delivery').appendChild(line_cache);
                    // } else if (line.state == 'Cancel') {
                    //     this.$el[0].querySelector('.cancel').appendChild(line_cache);
                    // } else if (line.state == 'Not-enough-material') {
                    //     this.$el[0].querySelector('.not-enough-material').appendChild(line_cache);
                    // }
                }
            }
            if (this.pos.config.play_sound) {
                this.pos.play_sound();
            }
        }
    });

    gui.define_screen({
        'name': 'kitchen_screen',
        'widget': KitchenScreen,
    });
});
