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
        button = t('button'),
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
            appsStatus: params.appsStatus,
            doRunAppStatus: params.doRunAppStatus
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
                col(),
                col()
            ]),
            thead([
                tr([
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
                    }, 'New Relations')),
                    th('Last run date'),
                    th('Next run date'),
                    th()
                ])
            ]),
            tbody({
                dataBind: {
                    foreach: 'appsStatus'
                }
            }, tr([
                td({
                    dataBind: {
                        text: 'name'
                    }
                }),
                td({
                    dataBind: {
                        html: 'statusIcon'
                    }
                }),
                td({
                    dataBind: {
                        html: 'updatedNodes'
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
                }),
                td({
                    dataBind: {
                        text: 'nextRunAt'
                    }
                }),
                td(
                    button({
                        class: 'btn btn-primary',
                        dataBind: {
                            click: '$component.doRunAppStatus'
                        }
                    }, 'Run')
                )
            ]))
        ]);
    }

    function template() {
        return div({
            class: 'component-reske-admin-apps-status',
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