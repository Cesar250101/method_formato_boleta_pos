odoo.define('pos_bus_restaurant.models', function (require) {

    var models = require('point_of_sale.models');

    models.load_models([
        {
            model: 'restaurant.floor',
            fields: ['name', 'background_color', 'table_ids', 'sequence'],
            domain: function (self) {
                return [['id', 'in', self.config.floor_ids]];
            },
            loaded: function (self, floors) {
                self.floor_ids = [];
                self.floors = floors;
                self.floors_by_id = {};
                for (var i = 0; i < floors.length; i++) {
                    floors[i].tables = [];
                    self.floors_by_id[floors[i].id] = floors[i];
                    self.floor_ids.push(floors[i]['id']);
                }
                self.floors = self.floors.sort(function (a, b) {
                    return a.sequence - b.sequence;
                });
                // neu len floors >= 1 thi iface_floorplan >= 1
                // va hien thi man hinh floor, table
                self.config.iface_floorplan = !!self.floors.length;
            }
        },
        {
            model: 'restaurant.table',
            fields: ['name', 'width', 'height', 'position_h', 'position_v', 'shape', 'floor_id', 'color', 'seats'],
            domain: function (self) {
                return [['floor_id', 'in', self.floor_ids]];
            },
            loaded: function (self, tables) {
                self.tables_by_id = {};
                for (var i = 0; i < tables.length; i++) {
                    self.tables_by_id[tables[i].id] = tables[i];
                    var floor = self.floors_by_id[tables[i].floor_id[0]];
                    if (floor) {
                        floor.tables.push(tables[i]);
                        tables[i].floor = floor;
                    }
                }
            }
        }
    ]);
});
