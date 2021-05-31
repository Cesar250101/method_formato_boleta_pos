odoo.define('pos_bus_restaurant.multi_print', function (require) {

    var models = require('point_of_sale.models');
    var multi_print = require('pos_restaurant.multiprint');
    var _super_order = models.Order.prototype;
    // remove core method because could not super parent method change
    // support multi variants and sale extra when cashies print via posbox
    _super_order.computeChanges = function (categories) {
        var current_res = this.build_line_resume();
        var old_res     = this.saved_resume || {};
        var json        = this.export_as_JSON();
        var add = [];
        var rem = [];
        var line_hash;

        for ( line_hash in current_res) {
            var curr = current_res[line_hash];
            var old  = old_res[line_hash];

            if (typeof old === 'undefined') {
                add.push({
                    'id':           curr.product_id,
                    'name':         this.pos.db.get_product_by_id(curr.product_id).display_name,
                    'name_wrapped': curr.product_name_wrapped,
                    'note':         curr.note,
                    'qty':          curr.qty,
                    'uom':          curr.uom,
                    'variants':     curr.variants,
                    'tags':         curr.tags,
                    'combo_items':  curr.combo_items,
                });
            } else if (old.qty < curr.qty) {
                add.push({
                    'id':           curr.product_id,
                    'name':         this.pos.db.get_product_by_id(curr.product_id).display_name,
                    'name_wrapped': curr.product_name_wrapped,
                    'note':         curr.note,
                    'qty':          curr.qty - old.qty,
                    'uom':          curr.uom,
                    'variants':     curr.variants,
                    'tags':         curr.tags,
                    'combo_items':  curr.combo_items,
                });
            } else if (old.qty > curr.qty) {
                rem.push({
                    'id':           curr.product_id,
                    'name':         this.pos.db.get_product_by_id(curr.product_id).display_name,
                    'name_wrapped': curr.product_name_wrapped,
                    'note':         curr.note,
                    'qty':          curr.qty - curr.qty,
                    'uom':          curr.uom,
                    'variants':     curr.variants,
                    'tags':         curr.tags,
                    'combo_items':  curr.combo_items,
                });
            }
        }

        for (line_hash in old_res) {
            if (typeof current_res[line_hash] === 'undefined') {
                var old = old_res[line_hash];
                rem.push({
                    'id':           old.product_id,
                    'name':         this.pos.db.get_product_by_id(old.product_id).display_name,
                    'name_wrapped': old.product_name_wrapped,
                    'note':         old.note,
                    'qty':          old.qty,
                    'uom':          old.uom,
                    'variants':     old.variants,
                    'tags':         old.tags,
                    'combo_items':  old.combo_items,
                });
            }
        }

        if(categories && categories.length > 0){
            // filter the added and removed orders to only contains
            // products that belong to one of the categories supplied as a parameter

            var self = this;

            var _add = [];
            var _rem = [];

            for(var i = 0; i < add.length; i++){
                if(self.pos.db.is_product_in_category(categories,add[i].id)){
                    _add.push(add[i]);
                }
            }
            add = _add;

            for(var i = 0; i < rem.length; i++){
                if(self.pos.db.is_product_in_category(categories,rem[i].id)){
                    _rem.push(rem[i]);
                }
            }
            rem = _rem;
        }

        var d = new Date();
        var hours   = '' + d.getHours();
            hours   = hours.length < 2 ? ('0' + hours) : hours;
        var minutes = '' + d.getMinutes();
            minutes = minutes.length < 2 ? ('0' + minutes) : minutes;

        return {
            'new': add,
            'cancelled': rem,
            'table': json.table || false,
            'floor': json.floor || false,
            'name': json.name  || 'unknown order',
            'time': {
                'hours':   hours,
                'minutes': minutes,
            },
        };
    };
    // // core method printChanges
    // _super_order.printChanges = function () {
    //     this.pos.printer_receipts = {};
    //     var printers = this.pos.printers;
    //     for (var i = 0; i < printers.length; i++) {
    //         var changes = this.computeChanges(printers[i].config.product_categories_ids);
    //         if (changes['new'].length > 0 || changes['cancelled'].length > 0) {
    //             var receipt = qweb.render('OrderChangeReceipt', {changes: changes, widget: this});
    //             var report_xml = qweb.render('OrderChangeReceipt_html', {changes: changes, widget: this});
    //             this.pos.report_xml = report_xml;
    //             this.pos.printer_receipts[printers[i].config.id] = receipt;
    //             printers[i].print(receipt);
    //             this.pos.gui.show_screen('report');
    //             this.pos.posbox_report_xml = receipt;
    //         }
    //     }
    // };
    //remove core method and add multi variants and sale extra to receipt kitchen
    _super_order.build_line_resume = function () {
        var resume = {};
        var self = this;
        this.orderlines.each(function (line) {
            if (line.mp_skip) {
                return;
            }
            var line_hash = line.get_line_diff_hash();
            var qty = Number(line.get_quantity());
            var note = line.get_note();
            var product_id = line.get_product().id;

            if (typeof resume[line_hash] === 'undefined') {
                resume[line_hash] = {
                    qty: qty,
                    note: note,
                    product_id: product_id,
                    product_name_wrapped: line.generate_wrapped_product_name(),
                    uom: [],
                    variants: [],
                    tags: [],
                    combo_items: []
                };
                if (line['variants']) {
                    resume[line_hash]['variants'] = line['variants'];
                }
                if (line['tags']) {
                    resume[line_hash]['tags'] = line['tags'];
                }
                if (line.uom_id) {
                    resume[line_hash]['uom'] = self.pos.uom_by_id[line.uom_id]
                }
                if (line.product.uom_id && !line.uom_id) {
                    resume[line_hash]['uom'] = self.pos.uom_by_id[line.product.uom_id[0]]
                }
                if (line.combo_items && line.combo_items.length) {
                    resume[line_hash]['combo_items'] = line['combo_items']
                }
            } else {
                resume[line_hash].qty += qty;
            }

        });
        return resume;
    };

});
