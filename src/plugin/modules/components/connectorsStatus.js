define([
    'kb_common/html',
    'knockout-plus',
    'kb_common/bootstrapUtils'
], function(
    html,
    ko,
    BS
) {
    'use strict';

    var t = html.tag,
        div = t('div'),
        table = t('table'),
        colgroup = t('colgroup'),
        col = t('col'),
        thead = t('thead'),
        tr = t('tr'),
        td = t('td'),
        th = t('th'),
        tbody = t('tbody');

    function viewModel(params) {
        return {
            connectorsStatus: params.connectorsStatus
        };
    }

    function buildTable() {
        return table({
            class: 'table table-striped'
        }, [
            colgroup([
                col(),
                col(),
                col(),
                col(),
                col(),
                col(),
                col()
            ]),
            thead([
                tr([
                    th('User'),
                    th('Name'),
                    th('Status'),
                    th(div({
                        style: {
                            display: 'inline-block',
                            textAlign: 'left'
                        }
                    }, 'Reinforced Nodes')),
                    th(div({
                        style: {
                            display: 'inline-block',
                            textAlign: 'left'
                        }
                    }, 'New Nodes')),
                    th(div({
                        style: {
                            display: 'inline-block',
                            textAlign: 'left'
                        }
                    }, 'New Relations'))
                ])
            ]),
            tbody({
                dataBind: {
                    foreach: 'connectorsStatus'
                }
            }, tr([
                td({
                    dataBind: {
                        text: 'user'
                    }
                }),
                td({
                    dataBind: {
                        text: 'name'
                    }
                }),
                td({
                    dataBind: {
                        text: 'status'
                    }
                }),
                td({
                    dataBind: {
                        text: 'updatedNodes'
                    }
                }),
                td({
                    dataBind: {
                        text: 'newNodes'
                    }
                }),
                td({
                    dataBind: {
                        text: 'newRelations'
                    }
                }),
                td({
                    dataBind: {
                        text: 'lastRunAt'
                    }
                })
            ]))
        ]);
    }

    function template() {
        return BS.buildCollapsiblePanel({
            title: 'Connectors Status',
            classes: ['component-reske-admin-connectors-status'],
            body: buildTable()
        });
    }

    function component() {
        return {
            viewModel: viewModel,
            template: template()
        };
    }
    return component;

});