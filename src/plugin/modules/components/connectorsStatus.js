define([
    'kb_common/html',
    'knockout-plus',
    'kb_common/bootstrapUtils'
], function (
    html,
    ko,
    BS
) {
    'use strict';

    var t = html.tag,
        div = t('div'),
        a = t('a'),
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
                    th('Obj Ref'),
                    th('Status'),
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
                    }, 'New Relations')),
                    th('Last ran')
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
                td(a({
                    dataBind: {
                        attr: {
                            href: '"#dataview/" + objectRef'
                        },
                        text: 'objectRef'
                    }
                })),
                td({
                    dataBind: {
                        html: 'statusIcon'
                    }
                }),
                td({
                    dataBind: {
                        html: 'newNodes'
                    }
                }),
                td({
                    dataBind: {
                        html: 'newRelations'
                    }
                }),
                td({
                    dataBind: {
                        html: 'lastRunAt'
                    }
                })
            ]))
        ]);
    }

    function template() {
        return div({
            class: 'component-reske-admin-connectors-status'
        }, buildTable());
    }

    function component() {
        return {
            viewModel: viewModel,
            template: template()
        };
    }
    return component;

});