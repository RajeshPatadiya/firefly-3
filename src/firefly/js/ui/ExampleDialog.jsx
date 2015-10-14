/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React from 'react/addons';

import TargetPanel from './TargetPanel.jsx';
import InputGroup from './InputGroup.jsx';
import Validate from '../util/Validate.js';
import ValidationField from './ValidationField.jsx';
import CheckboxGroupInputField from './CheckboxGroupInputField.jsx';
import RadioGroupInputField from './RadioGroupInputField.jsx';
import ListBoxInputField from './ListBoxInputField.jsx';
import {ServerRequest, ID_NOT_DEFINED} from '../data/ServerRequest.js';
import WebPlotRequest from '../visualize/WebPlotRequest.js';
import Histogram from '../visualize/Histogram.jsx';
import JunkFormButton from './JunkFormButton.jsx';
import CompleteButton from './CompleteButton.jsx';
import {WorldPt, ImagePt, Pt} from '../visualize/Point.js';
import FieldGroupStore from '../store/FieldGroupStore.js';
import FieldGroupActions from '../actions/FieldGroupActions.js';
import FieldGroup from './FieldGroup.jsx';
import {defineDialog} from './DialogRootContainer.jsx';
import PopupPanel from './PopupPanel.jsx';
import DialogActions from '../actions/DialogActions.js';

import CollapsiblePanel from './panel/CollapsiblePanel.jsx';


/**
 *
 * @param inFields
 * @param actionsConst
 * @return {*}
 */
var testReducer= function(inFields, actionsConst) {
    if (!inFields)  {
        var fields= {
            field1: {
                fieldKey: 'field1',
                value: '3',
                validator: Validate.intRange.bind(null, 1, 10, 'my test field'),
                tooltip: 'this is a tip for field 1',
                label: 'Int Value:'
            },
            field2: {
                fieldKey: 'field2',
                value: '',
                validator: Validate.floatRange.bind(null, 1.2, 22.4, 2, 'a float field'),
                tooltip: 'field 2 tool tip',
                label: 'Float Value:',
                labelWidth: 100
            },
            field4: {
                fieldKey: 'field4',
                value: '',
                validator: Validate.validateEmail.bind(null, 'an email field'),
                tooltip: 'Please enter an email',
                label: 'Email:'
            }
        };
        return fields;
    }
    else {
        return inFields;
    }
};

class ExampleDialog {

    constructor() {
        var popup= (
            //<PopupPanel title={'Example Dialog'} closePromise={closePromise}>
            <PopupPanel title={'Example Dialog'} >
                <AllTest  groupKey={'DEMO_FORM'} />
            </PopupPanel>
        );

        FieldGroupActions.initFieldGroup({

                groupKey : 'DEMO_FORM',
                reducerFunc : testReducer,
                validatorFunc: null,
                keepState: true
            }
        );
        defineDialog('ExampleDialog', popup);
    }

    showDialog() {

        DialogActions.showDialog({dialogId: 'ExampleDialog'});
    }
}


var AllTest = React.createClass({

    showResults(success, request) {
        var statStr= `validate state: ${success}`;
        //var request= FieldGroupUtils.getResults(this.props.groupKey);
        console.log(statStr);
        console.log(request);

        var s= Object.keys(request).reduce(function(buildString,k,idx,array){
            buildString+=`${k}=${request[k]}`;
            if (idx<array.length-1) buildString+=', ';
            return buildString;
        },'');


        var resolver= null;
        var closePromise= new Promise(function(resolve, reject) {
            resolver= resolve;
        });

        var results= (
            <PopupPanel title={'Example Dialog'} closePromise={closePromise} >
                {this.makeResultInfoContent(statStr,s,resolver)}
            </PopupPanel>
        );

        defineDialog('ResultsFromExampleDialog', results);
        DialogActions.showDialog({dialogId: 'ResultsFromExampleDialog'});
    },


    makeResultInfoContent(statStr,s,closePromiseClick) {
        return (
            <div style={{padding:'5px'}}>
                <br/>{statStr}<br/><br/>{s}
                <button type='button' onClick={closePromiseClick}>Another Close</button>
                <CompleteButton dialogId='ResultsFromExampleDialog' />
            </div>
        );
    },



    resultsFail(request) {
        this.showResults(false,request);
    },

    resultsSuccess(request) {
        this.showResults(true,request);
    },

    render() {

        return (
            <div style={{padding:'5px'}}>
                <FieldGroup groupKey={'DEMO_FORM'} reducerFunc={testReducer} validatorFunc={null} keepState={true}>
                    <InputGroup labelWidth={130}>
                        <TargetPanel groupKey='DEMO_FORM' />
                        <ValidationField fieldKey={'field1'}
                                         groupKey='DEMO_FORM'/>
                        <ValidationField fieldKey='field2'
                                         groupKey='DEMO_FORM'/>
                        <ValidationField fieldKey='field3'
                                         initialState= {{
                            fieldKey: 'field3',
                            value: '12',
                            validator: Validate.floatRange.bind(null, 1.23, 1000, 3,'field 3'),
                            tooltip: 'more tipping',
                            label : 'Another Float:',
                            labelWidth : 100
                        }}
                                         groupKey='DEMO_FORM'/>
                        <ValidationField fieldKey={'field4'}
                                         groupKey='DEMO_FORM'/>

                        <br/><br/>
                        <CheckboxGroupInputField
                            initialState= {{
                            value: '_all_',
                            tooltip: 'Please select some boxes',
                            label : 'Checkbox Group:'
                        }}
                            options={
                            [
                                {label: 'Apple', value: 'A'},
                                {label: 'Banana', value: 'B'},
                                {label: 'Cranberry', value: 'C'},
                                {label: 'Dates', value: 'D'},
                                {label: 'Grapes', value: 'G'}
                            ]
                            }
                            fieldKey='checkBoxGrpFld'
                            groupKey='DEMO_FORM'/>

                        <br/><br/>
                        <RadioGroupInputField  initialState= {{
                            tooltip: 'Please select an option',
                            label : 'Radio Group:'
                        }}
                                               options={
                                                [
                                                    {label: 'Option 1', value: 'opt1'},
                                                    {label: 'Option 2', value: 'opt2'},
                                                    {label: 'Option 3', value: 'opt3'},
                                                    {label: 'Option 4', value: 'opt4'}
                                                ]
                                                }
                                               fieldKey='radioGrpFld'
                                               groupKey='DEMO_FORM'/>
                        <br/><br/>

                        <ListBoxInputField  initialState= {{
                            tooltip: 'Please select an option',
                            label : 'ListBox Field:'
                        }}
                          options={
                            [
                                {label: 'Item 1', value: 'i1'},
                                {label: 'Another Item 2', value: 'i2'},
                                {label: 'Yet Another 3', value: 'i3'},
                                {label: 'And one more 4', value: 'i4'}
                            ]
                            }
                                            multiple={false}
                                            fieldKey='listBoxFld'
                                            groupKey='DEMO_FORM'/>
                        <br/><br/>

                        <CompleteButton groupKey='DEMO_FORM'
                                        onSuccess={this.resultsSuccess}
                                        onFail={this.resultsFail}
                                        dialogId='ExampleDialog'
                            />
                    </InputGroup>
                </FieldGroup>

                <div>
                    <CollapsiblePanel header='Sample Histogram'>
                        <Histogram data={[
                           [1,-2.5138013781265,-2.0943590644815],
                           [4,-2.0943590644815,-1.8749167508365],
                           [11,-1.8749167508365,-1.6554744371915],
                           [12,-1.6554744371915,-1.4360321235466],
                           [18,-1.4360321235466,-1.2165898099016],
                           [15,-1.2165898099016,-1.1571474962565],
                           [20,-1.1571474962565,-0.85720518261159],
                           [24,-0.85720518261159,-0.77770518261159],
                           [21,-0.77770518261159,-0.55826286896661],
                           [36,-0.55826286896661,-0.33882055532162],
                           [40,-0.33882055532162,-0.11937824167663],
                           [51,-0.11937824167663,0.10006407196835],
                           [59,0.10006407196835,0.21850638561334],
                           [40,0.21850638561334,0.31950638561334],
                           [42,0.31950638561334,0.53894869925832],
                           [36,0.53894869925832,0.75839101290331],
                           [40,0.75839101290331,0.9778333265483],
                           [36,0.9778333265483,1.1972756401933],
                           [23,1.1972756401933,1.4167179538383],
                           [18,1.4167179538383,1.6361602674833],
                           [9,1.6361602674833,1.8556025811282],
                           [12,1.8556025811282,2.0750448947732],
                           [0,2.0750448947732,2.2944872084182],
                           [4,2.2944872084182,2.312472786789]
                    ]}
                                   desc=''
                                   binColor='#f8ac6c'
                                   height='100'
                            />
                    </CollapsiblePanel>
                </div>

            </div>

        );
    }
});


//<JunkFormButton groupKey='DEMO_FORM' label='submit'/>

const LABEL_WIDTH= 105;

export default ExampleDialog;