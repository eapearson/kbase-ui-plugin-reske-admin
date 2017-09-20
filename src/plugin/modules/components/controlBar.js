define([
    'knockout-plus',
    'kb_common/html'
], function (
    ko,
    html
) {
    'use strict';
    var t = html.tag,
        div = t('div'),
        span = t('span'),
        button = t('button');

    function viewModel(params) {
        return {
            message: params.message,
            resetStatus: params.resetStatus,
            pollStatus: params.pollStatus,
            doReset: params.doReset
        };
    }

    function template() {
        return div({
            class: 'btn-toolbar pull-right',
            style: {
                marginBottom: '10px'
            }
        }, [
            div({
                class: 'btn-group'
            }, [
                div({
                    dataBind: {
                        html: 'message'
                    },
                    style: {
                        display: 'inline-block',
                        // width: '10em',
                        textAlign: 'right'
                    }
                }),
                // div({
                //     style: {
                //         display: 'inline-block',
                //         width: '1.5em',
                //         margin: '4px',
                //         textAlign: 'center'
                //     }
                // }, [

                //     '<!-- ko if: pollStatus() === "idle" -->',
                //     span({
                //         class: 'fa fa-refresh',
                //         style: {
                //             color: 'gray'
                //         }
                //     }),
                //     '<!-- /ko -->',
                //     '<!-- ko if: pollStatus() === "busy" -->',
                //     span({
                //         class: 'fa fa-refresh fa-spin fa-fw',
                //         style: {
                //             color: 'green'
                //         }
                //     }),
                //     '<!-- /ko -->'
                // ])
            ])
        ]);

    }

    function component() {
        return {
            viewModel: viewModel,
            template: template()
        };
    }

    return component;
});