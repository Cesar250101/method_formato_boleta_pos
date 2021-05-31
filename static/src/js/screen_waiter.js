odoo.define('pos_bus_restaurant.kitchen_waiter', function (require) {
    var screens = require('point_of_sale.screens');
    var floors = require('pos_restaurant.floors');
    var gui = require('point_of_sale.gui');
    var FloorScreenWidget;
    var SplitbillScreenWidget;

    _.each(gui.Gui.prototype.screen_classes, function (o) {
        if (o.name == 'floors') {
            FloorScreenWidget = o.widget;
            FloorScreenWidget.include({
                start: function () {
                    var self = this;
                    this._super();
                    this.pos.bind('update:floor-screen', function () {
                        self.renderElement();
                    })
                },
            })
        }
        if (o.name == 'splitbill') {
            SplitbillScreenWidget = o.widget;
            SplitbillScreenWidget.include({
                pay: function (order, neworder, splitlines) {
                    var res = this._super(order, neworder, splitlines);
                    return res;
                }
            })
        }
    });

    screens.OrderWidget.include({
        remove_orderline: function (order_line) {
            var res = this._super(order_line);
            if ((order_line.syncing == false || !order_line.syncing) && this.pos.pos_bus) {
                order_line.trigger_line_removing();
            }
            return res
        },
        update_summary: function () {
            try {
                this._super();
                var delivery_kitchen = this.pos.get_order().has_line_delivery_kitchen();
                var need_delivery = this.pos.get_order().has_data_need_delivery();
                var high_priority = this.pos.get_order().has_line_high_priority();
                var buttons = this.getParent().action_buttons;
                if (buttons && buttons.set_order_done) {
                    buttons.set_order_done.highlight(need_delivery);
                }
                if (buttons && buttons.set_line_exit_high_priority) {
                    buttons.set_line_exit_high_priority.highlight(high_priority);
                }
                if (buttons && buttons.delivery_kitchen) {
                    buttons.delivery_kitchen.highlight(delivery_kitchen);
                }
                $('.o_in_home_menu').replaceWith();
            } catch (ex) {
                console.log('dont worries, client without table select');
            }
        },
        render_orderline: function (orderline) {
            var self = this;
            var el_node = this._super(orderline);
            var cancel_button = el_node.querySelector('.cancel');
            if (cancel_button) {
                cancel_button.addEventListener('click', function () {
                    orderline.set_state('Cancel');
                });
            }
            var done_button = el_node.querySelector('.done');
            if (done_button) {
                done_button.addEventListener('click', function () {
                    orderline.set_state('Done');
                });
            }
            var error_button = el_node.querySelector('.error');
            if (error_button) {
                error_button.addEventListener('click', function () {
                    orderline.set_state('Error');
                });
            }
            var priority_button = el_node.querySelector('.priority');
            if (priority_button) {
                priority_button.addEventListener('click', function () {
                    orderline.set_state('High-Priority');
                });
            }
            var confirm_button = el_node.querySelector('.confirm');
            if (confirm_button) {
                confirm_button.addEventListener('click', function () {
                    orderline.set_state('Waiting');
                });
            }
            var put_back_button = el_node.querySelector('.put-back');
            if (put_back_button) {
                put_back_button.addEventListener('click', function () {
                    orderline.set_state('Waiting-delivery');
                });
            }
            return el_node;
        }
    });

    floors.TableWidget.include({
        init: function (parent, options) {
            this.pos = parent.pos;
            this._super(parent, options);
        },
        get_order_by_widget: function () {
            var self = this;
            var orders = this.pos.get('orders').models;
            var order = _.find(orders, function (o) {
                return o.table && o.table.id == self.table.id
            });
            return order;
        },
        need_to_order: function () {
            var order = this.get_order_by_widget();
            if (order) {
                for (var i = 0; i < order.orderlines.models.length; i++) {
                    var line = order.orderlines.models[i];
                    if (line.state == 'Waiting-delivery') {
                        return 1;
                    }
                }
                return 0;
            } else {
                return 0;
            }
        },
        get_waiting_delivery: function () {
            var order = this.get_order_by_widget();
            if (order) {
                var count = 0;
                for (var i = 0; i < order.orderlines.models.length; i++) {
                    var line = order.orderlines.models[i];
                    if (line.state == 'Waiting-delivery') {
                        count += 1;
                    }
                }
                return count;
            } else {
                return 0;
            }
        },
        get_info_order: function () {
            var order = this.get_order_by_widget();
            var result = {
                amount_total: 0,
                created_time: null
            };
            if (order) {
                var order_json = order.export_as_JSON();
                result['created_time'] = order_json['created_time'];
                result['amount_total'] = order_json['amount_total'];
            }
            return result;
        },
        get_error: function () {
            var order = this.get_order_by_widget();
            if (order) {
                var count = 0;
                for (var i = 0; i < order.orderlines.models.length; i++) {
                    var line = order.orderlines.models[i];
                    if (line.state == 'Error') {
                        count += 1;
                    }
                }
                return count;
            } else {
                return 0;
            }
        }
    });

    var set_order_done = screens.ActionButtonWidget.extend({
        template: 'set_order_done',
        button_click: function () {
            var order = this.pos.get('selectedOrder');
            if (order.orderlines.length > 0) {
                for (var i = 0; i < order.orderlines.models.length; i++) {
                    var line = order.orderlines.models[i];
                    if (line.state == 'Waiting-delivery') {
                        line.set_state('Done');
                    }
                }
            }
        }
    });

    screens.define_action_button({
        'name': 'set_order_done',
        'widget': set_order_done,
        'condition': function () {
            return this.pos.config.screen_type && this.pos.config.screen_type !== 'kitchen' && this.pos.config.set_order_done;
        }
    });

    var set_line_high_priority = screens.ActionButtonWidget.extend({
        template: 'set_line_high_priority',
        button_click: function () {
            var order = this.pos.get('selectedOrder');
            if (order.orderlines.length > 0) {
                for (var i = 0; i < order.orderlines.models.length; i++) {
                    var line = order.orderlines.models[i];
                    if (line.state != 'Kitchen Waiting cancel' && line.state != 'Done' && line.state != 'Cancel' && line.state != 'Error' && line.state != 'Waiting-delivery') {
                        line.set_state('High-Priority');
                    }
                }
            }
        }
    });

    screens.define_action_button({
        'name': 'set_line_high_priority',
        'widget': set_line_high_priority,
        'condition': function () {
            return this.pos.config.screen_type && this.pos.config.screen_type !== 'kitchen' && this.pos.config.set_line_high_priority;
        }
    });

    var set_line_exit_high_priority = screens.ActionButtonWidget.extend({
        template: 'set_line_exit_high_priority',
        button_click: function () {
            var order = this.pos.get('selectedOrder');
            if (order.orderlines.length > 0) {
                for (var i = 0; i < order.orderlines.models.length; i++) {
                    var line = order.orderlines.models[i];
                    if (line && line.state && line.state == 'High-Priority') {
                        line.set_state('Waiting');
                    }
                }
            }
        }
    });
    screens.define_action_button({
        'name': 'set_line_exit_high_priority',
        'widget': set_line_exit_high_priority,
        'condition': function () {
            return this.pos.config.screen_type && this.pos.config.screen_type !== 'kitchen' && this.pos.config.set_line_exit_high_priority;
        }
    });

    var button_print_last_submit_order = screens.ActionButtonWidget.extend({
        template: 'button_print_last_submit_order',
        button_click: function () {
            var order = this.pos.get('selectedOrder');
            if (order) {
                order.reprint_last_receipt_kitchen();
            }
        }
    });

    screens.define_action_button({
        'name': 'button_print_last_submit_order',
        'widget': button_print_last_submit_order,
        'condition': function () {
            return this.pos.config.screen_type && this.pos.config.screen_type !== 'kitchen' && this.pos.config.print_last_submit_order;
        }
    });

    var delivery_kitchen = screens.ActionButtonWidget.extend({
        template: 'delivery_kitchen',
        button_click: function () {
            var order = this.pos.get('selectedOrder');
            if (order.orderlines.length > 0) {
                for (var i = 0; i < order.orderlines.models.length; i++) {
                    var line = order.orderlines.models[i];
                    if (line && line.state && line.state == 'draft') {
                        line.set_state('Waiting');
                    }
                }
            }
        }
    });
    screens.define_action_button({
        'name': 'delivery_kitchen',
        'widget': delivery_kitchen,
        'condition': function () {
            return this.pos.config.screen_type && this.pos.config.screen_type !== 'kitchen' && this.pos.config.send_order_to_kitchen;
        }
    });
});
