# -*- coding: utf-8 -*-
from odoo import http

# class MethodFormatoBoletaPos(http.Controller):
#     @http.route('/method_formato_boleta_pos/method_formato_boleta_pos/', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/method_formato_boleta_pos/method_formato_boleta_pos/objects/', auth='public')
#     def list(self, **kw):
#         return http.request.render('method_formato_boleta_pos.listing', {
#             'root': '/method_formato_boleta_pos/method_formato_boleta_pos',
#             'objects': http.request.env['method_formato_boleta_pos.method_formato_boleta_pos'].search([]),
#         })

#     @http.route('/method_formato_boleta_pos/method_formato_boleta_pos/objects/<model("method_formato_boleta_pos.method_formato_boleta_pos"):obj>/', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('method_formato_boleta_pos.object', {
#             'object': obj
#         })