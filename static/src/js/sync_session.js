odoo.define('pos_bus_restaurant.sync_session', function (require) {

    var models = require('point_of_sale.models');
    var pos_bus = require('pos_bus.synchronization');

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        sort_by: function (field, reverse, primer) {
            var key = primer ?
                function (x) {
                    return primer(x[field])
                } :
                function (x) {
                    return x[field]
                };
            reverse = !reverse ? 1 : -1;
            return function (a, b) {
                return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
            }
        },
        set_table: function (table) {
            if (this.order_to_transfer_to_different_table && table && this.pos_bus) {
                var order_to_transfer_to_different_table = this.order_to_transfer_to_different_table;
                if (order_to_transfer_to_different_table.syncing == false || !order_to_transfer_to_different_table.syncing) {
                    order_to_transfer_to_different_table.syncing = true;
                    this.pos_bus.send_notification({
                        action: 'order_transfer_new_table',
                        data: {
                            uid: order_to_transfer_to_different_table.uid,
                            table_id: table.id,
                            floor_id: table.floor_id[0],
                        },
                        order: order_to_transfer_to_different_table.export_as_JSON(),
                        bus_id: this.config.bus_id[0],
                        order_uid: order_to_transfer_to_different_table.uid
                    });
                    order_to_transfer_to_different_table.syncing = false;
                }
            }
            var res = _super_posmodel.set_table.apply(this, arguments);
            if (table == null) {
                this.trigger('reset:count_item');
            }
            return res;
        },
        load_server_data: function () {
            var self = this;
            return _super_posmodel.load_server_data.apply(this, arguments).then(function () {
                self.config.iface_floorplan = self.floors.length;
            });
        },
        // play sound when new transaction coming
        play_sound: function () {
            var src = "/pos_retail_restaurant/static/src/sounds/demonstrative.mp3";
            $('body').append('<audio src="' + src + '" autoplay="true"></audio>');
        },
        // sync between sesion on restaurant
        syncing_sessions: function (message) {
            var action = message['action'] || null;
            console.log(action);
            var sync_between_waiters = this.config.sync_between_waiters;
            if (!sync_between_waiters && this.config.screen_type != 'kitchen') {
                console.warn('!sync_between_waiters: ' + !sync_between_waiters)
                console.warn('this.config.screen_type: ' + this.config.screen_type)
                return null;
            }
            if (action == null) {
                console.warn('action: ' + action);
                return;
            }
            _super_posmodel.syncing_sessions.apply(this, arguments);
            if (message['action'] == 'set_state') {
                this.sync_state(message['data']);
            }
            if (message['action'] == 'order_transfer_new_table') {
                this.sync_order_transfer_new_table(message['data']);
            }
            if (message['action'] == 'set_customer_count') {
                this.sync_set_customer_count(message['data']);
            }
            if (message['action'] == 'request_printer') {
                this.sync_request_printer(message['data']);
            }
            if (message['action'] == 'set_note') {
                this.sync_set_note(message['data']);
            }
            if (this.floors.length && this.config.screen_type && this.config.screen_type !== 'kitchen') {
                this.trigger('update:floor-screen');
            }
            if (['unlink_order', 'line_removing', 'trigger_update_line', 'set_line_note', 'set_state', 'order_transfer_new_table', 'set_note'].indexOf(action) != -1) {
                this.trigger('reload:kitchen_screen');
            }
        },
        // neu la man hinh nha bep / bar
        // khong quan tam no la floor hay table hay pos cashier
        // luon luon dong bo vs tat ca
        sync_order_adding: function (vals) {
            _super_posmodel.sync_order_adding.apply(this, arguments);
            var order_exist = this.check_order_have_exist(vals);
            if (order_exist) {
                return;
            } else {
                if (this.config.screen_type !== 'waiter') {
                    var orders = this.get('orders', []);
                    if (vals['floor_id'] && !this.floors_by_id[vals['floor_id']]) {
                        vals['floor_id'] = null;
                    }
                    if (vals['table_id'] && !this.floors_by_id[vals['table_id']]) {
                        vals['table_id'] = null;
                    }
                    var order = new models.Order({}, {pos: this, json: vals});
                    order.syncing = true;
                    orders.add(order);
                    order.trigger('change', order);
                    order.syncing = false;
                }
            }
        },
        // update trang thai cua line
        sync_state: function (vals) {
            var line = this.get_line_by_uid(vals['uid']);
            if (line) {
                line.syncing = true;
                line.set_state(vals['state']);
                line.syncing = false;
            }
        },
        // dong bo chuyen ban, tach ban
        sync_order_transfer_new_table: function (vals) {
            var order = this.get_order_by_uid(vals.uid);
            var current_screen = this.gui.get_current_screen();
            if (order != undefined) {
                if (this.floors_by_id[vals.floor_id] && this.tables_by_id[vals.table_id]) {
                    var table = this.tables_by_id[vals.table_id];
                    var floor = this.floors_by_id[vals.floor_id];
                    if (table && floor) {
                        order.table = table;
                        order.table_id = table.id;
                        order.floor = floor;
                        order.floor_id = floor.id;
                        order.trigger('change', order);
                        if (current_screen) {
                            this.gui.show_screen(current_screen);
                        }
                        $('.order-selector').hide();
                    }
                    if (!table || !floor) {
                        order.table = null;
                        order.trigger('change', order);
                    }
                }
            }
        },
        // dong bo tong so khach hang tren ban
        sync_set_customer_count: function (vals) { // update count guest
            var order = this.get_order_by_uid(vals.uid);
            if (order) {
                order.syncing = true;
                order.set_customer_count(vals.count)
                order.trigger('change', order);
                order.syncing = false;
            }
        },
        // dong bo khi in xong
        sync_request_printer: function (vals) { // update variable set_dirty of line
            var order = this.get_order_by_uid(vals.uid);
            if (order) {
                order.syncing = true;
                order.orderlines.each(function (line) {
                    line.set_dirty(false);
                });
                order.saved_resume = order.build_line_resume();
                order.trigger('change', order);
                order.syncing = false;
            }
        },
        // dong bo ghi chu cua line
        sync_set_note: function (vals) {
            var line = this.get_line_by_uid(vals['uid']);
            if (line) {
                line.syncing = true;
                line.set_note(vals['note']);
                line.syncing = false;
            }
        },

        // return data for floors/tables screen
        get_count_need_print: function (table) {
            var orders = this.get('orders').models;
            var vals = {
                'active_print': 0,
                'unactive_print': 0,
            };
            var orders_current = [];
            for (var x = 0; x < orders.length; x++) {
                if (orders[x].table && orders[x].table.id == table.id) {
                    orders_current.push(orders[x])
                }
            }
            if (orders_current.length) {
                for (i in orders_current) {
                    var order = orders_current[i];
                    for (var i = 0; i < order.orderlines.models.length; i++) {
                        var line = order.orderlines.models[i];
                        if (line.mp_dirty == true) {
                            vals['active_print'] += 1;
                        } else {
                            vals['unactive_print'] += 1
                        }
                    }
                }
            }
            return vals;
        }
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        has_line_delivery_kitchen: function () {
            var delivery_kitchen = false;
            this.orderlines.each(function (line) {
                if (line['state'] == 'draft') {
                    delivery_kitchen = true
                }
            });
            return delivery_kitchen;
        },

        has_line_high_priority: function () {
            var high_priority = false;
            this.orderlines.each(function (line) {
                if (line['state'] == 'High-Priority') {
                    high_priority = true
                }
            });
            return high_priority;
        },

        has_data_need_delivery: function () {
            var need_delivery = false;
            this.orderlines.each(function (line) {
                if (line['state'] == 'Waiting-delivery') {
                    need_delivery = true
                }
            });
            return need_delivery;
        },

        export_as_JSON: function () {
            var json = _super_order.export_as_JSON.apply(this, arguments);
            if (this.notify_messages) {
                json.notify_messages = this.notify_messages;
            }
            return json;
        },
        initialize: function (attributes, options) {
            var self = this;
            _super_order.initialize.apply(this, arguments)
            if (!this.notify_messages) {
                this.notify_messages = {};
            }
            this.state = false;
            this.bind('change', function (order) {
                self.pos.trigger('update:floor-screen')
            });
            this.orderlines.bind('change add remove', function (line) {
                self.pos.trigger('update:floor-screen')
            })
            // if (this.pos.pos_bus) {
            //     this.bind('remove', function (order) {
            //         var orders = self.pos.get('orders')
            //         var other_order_the_same_table = orders.find(function (other_order) {
            //             if (order.table && other_order.table && other_order.uid != order && order.table.id == other_order.table.id) {
            //                 return other_order;
            //             }
            //         })
            //         if (other_order_the_same_table) {
            //             if (other_order_the_same_table.syncing != true || !other_order_the_same_table.syncing) {
            //                 self.pos.pos_bus.send_notification({
            //                     action: 're-sync-slip-order',
            //                     data: {
            //                         uid: other_order_the_same_table.uid,
            //                     },
            //                     order: other_order_the_same_table.export_as_JSON(),
            //                     bus_id: this.pos.config.bus_id[0],
            //                     order_uid: other_order_the_same_table.uid,
            //                 });
            //             }
            //         }
            //
            //     })
            // }
        },
        set_customer_count: function (count) { //sync to other sessions
            var res = _super_order.set_customer_count.apply(this, arguments)
            if ((this.syncing == false || !this.syncing) && this.pos.pos_bus) {
                var order = this.export_as_JSON();
                this.pos.pos_bus.send_notification({
                    action: 'set_customer_count',
                    data: {
                        uid: this.uid,
                        count: count
                    },
                    bus_id: this.pos.config.bus_id[0],
                    order_uid: order['uid'],
                });
            }
            return res
        },
        reprint_last_receipt_kitchen: function () {
            if (!this.pos.printer_receipts) {
                return this.pos.gui.show_popup('confirm', {
                    title: 'Error',
                    body: 'Have not any last orders submit'
                });
            }
            var printers = this.pos.printers;
            for (var i = 0; i < printers.length; i++) {
                var printer = printers[i];
                var printer_id = printer.config.id;
                if (this.pos.printer_receipts[printer_id]) {
                    printer.print(this.pos.printer_receipts[printer_id]);
                }
            }
        },
    });

    var _super_order_line = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function () {
            _super_order_line.initialize.apply(this, arguments);
            if (!this.cancel_reason) {
                this.cancel_reason = '';
            }
            if (!this.creation_time) {
                this.creation_time = new Date().toLocaleTimeString();
            }
        },
        init_from_JSON: function (json) {
            if (json.state) {
                this.state = json.state;
            }
            if (json.creation_time) {
                this.creation_time = json.creation_time;
            }
            if (json.qty_new) {
                this.qty_new = json.qty_new;
            }
            if (json.cancel_reason) {
                this.cancel_reason = json.cancel_reason;
            }
            if (json.creation_time) {
                this.creation_time = json.creation_time;
            }
            if (json.quantity_done) {
                this.quantity_done = json.quantity_done;
            }
            if (json.quantity_wait) {
                this.quantity_wait = json.quantity_wait;
            }
            _super_order_line.init_from_JSON.apply(this, arguments);
        },
        export_as_JSON: function () {
            var json = _super_order_line.export_as_JSON.apply(this, arguments);
            if (!this.state) { // could not add on initialize() function because difference line uid before and after initialize
                this.set_state('draft');
            }
            if (this.state) {
                json.state = this.state;
            }
            if (this.cancel_reason) {
                json.cancel_reason = this.cancel_reason;
            }
            if (this.qty_new) {
                json.qty_new = this.qty_new;
            }
            if (this.creation_time) {
                json.creation_time = this.creation_time;
            }
            if (this.quantity_done) {
                json.quantity_done = this.quantity_done;
            }
            if (this.quantity_wait) {
                json.quantity_wait = this.quantity_wait;
            }
            return json;
        },
        printable: function () {
            if (this.get_product()) {
                return _super_order_line.printable.apply(this, arguments)
            } else {
                return null;
            }
        },
        product_url: function (product_id) {
            return window.location.origin + '/web/image?model=product.product&field=image_medium&id=' + product_id;
        },
        set_quantity: function (quantity) {
            // only waiters can set quantity only
            if (!this.pos.the_first_load || this.pos.the_first_load == false) {
                if (this.pos.config.screen_type != 'kitchen') { // only applied on screen not kitchen
                    if (this.state == 'Done') {
                        this.set_state('Waiting')
                    }
                    if (this.state == 'Waiting-delivery') {
                        this.set_state('Done'); // process to done
                        this.set_state('Waiting'); // and back to Waiting status
                    }
                }
            }
            return _super_order_line.set_quantity.apply(this, arguments);
        },
        set_note: function (note) { //sync to other sessions
            var res = _super_order_line.set_note.apply(this, arguments);
            if ((this.syncing == false || !this.syncing) && this.pos.pos_bus) {
                var order = this.order.export_as_JSON();
                this.pos.pos_bus.send_notification({
                    action: 'set_note',
                    data: {
                        uid: this.uid,
                        note: note,
                    },
                    bus_id: this.pos.config.bus_id[0],
                    order_uid: order.uid,
                });
            }
            return res;
        },
        set_state: function (state) {
            this.state = state;
            this.trigger('change', this);
            if ((!this.syncing || this.syncing == false) && this.pos.pos_bus) {
                this.pos.sync_line_set_state_datas[this.uid] = {
                    action: 'set_state',
                    data: {
                        uid: this.uid,
                        state: state
                    },
                    bus_id: this.pos.config.bus_id[0],
                    order_uid: this.order['uid']
                }
            }
            // ------------------------------
            // Manufacturing integration
            // ------------------------------
            // start new line, set wait = quantity, done is 0
            if (state == 'draft') {
                this.quantity_wait = this.quantity;
                this.quantity_done = 0;
            }
            if (state == 'Cancel') {
                this.state = 'Cancel';
                this.set_quantity(this.quantity - this.quantity_wait);
                this.quantity_done = this.quantity;
                this.quantity_wait = 0;
            }
            if (state == 'Done') {
                this.quantity_done = this.quantity;
                this.quantity_wait = 0;
            }
            if (state == 'Waiting-delivery') {
                // rpc.query({
                //     model: 'product.template',
                //     method: 'process_from_kitchen',
                //     args: [this],
                // }).then(function (result) {
                //     console.log('result of call process_from_kitchen: ' + result)
                // }).fail(function (type, error) {
                //     self.pos.gui.show_popup('error-traceback', {
                //         'title': error.data.message,
                //         'body': error.data.debug
                //     });
                // });
            }
            // ki???m tra ????n h??ng xem c?? d??ng n??o l?? waiting delivery kh??ng
            var has_line_waitinng_delivery = this.order.has_data_need_delivery();
            if (has_line_waitinng_delivery) {
                var $order_content = $("[data-uid='" + this.order.uid + "']");
                $order_content.addClass('order-waiting-delivery');
            } else {
                var $order_content = $("[data-uid='" + this.order.uid + "']");
                $order_content.removeClass('order-waiting-delivery');
            }
        },
        get_line_diff_hash: function () {
            var str = this.id + '|';
            if (this.get_note()) {
                str += this.get_note();
            }
            if (this.uom_id) {
                str += this.uom_id;
            }
            if (this.variants && this.variants.length) {
                for (var i=0; i < this.variants.length; i++) {
                    var variant = this.variants[i];
                    str += variant['attribute_id'][0];
                    str += '|' + variant['value_id'][0];
                }
            }
            if (this.tags && this.tags.length) {
                for (var i=0; i < this.tags.length; i++) {
                    var tag = this.tags[i];
                    str += '|' + tag['id'];
                }
            }
            if (this.combo_items && this.combo_items.length) {
                for (var i=0; i < this.combo_items.length; i++) {
                    var combo = this.combo_items[i];
                    str += '|' + combo['id'];
                }
            }
            return str
        },
    });
});
