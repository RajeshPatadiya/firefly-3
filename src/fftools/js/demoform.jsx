/*jshint browserify:true*/
/*globals firefly, onFireflyLoaded*/
/*jshint esnext:true*/
"use strict";


require("babel/polyfill");
var React= require('react/addons');

var InputFormModel= require ("ipac-firefly/ui/model/InputFormModel.js");
var TargetPanel= require ("ipac-firefly/ui/TargetPanel.jsx");
var InputGroup= require ("ipac-firefly/ui/InputGroup.jsx");
var Validate= require("ipac-firefly/util/Validate.js");
import ValidationField from "ipac-firefly/ui/ValidationField.jsx";

var myDispatcher= require("./Dispatcher.js");
var FormButton= require ("./FormButton.jsx");


var testFormModel= new InputFormModel.FormModel(
 {
     field1: {
         fieldKey: 'field1',
         value: '3',
         validator: Validate.intRange.bind(null, 1, 10, "my test field"),
         tooltip: "this is a tip for field 1",
         label : "Hello again"
     },
     field2: {
         fieldKey: 'field2',
         value: '',
         validator: Validate.floatRange.bind(null, 1.2, 22.4, 2,"a float field"),
         tooltip: "field 2 tool tip",
         label : "test label",
         labelWidth : "100"
     }
 }
);
testFormModel.initDispatcher(myDispatcher);


var makeField3State= function() {
    return {
        fieldKey: 'field3',
        value: '12',
        validator: Validate.floatRange.bind(null, 1.23, 1000, 3,"field 3"),
        tooltip: "more tipping",
        label : "Another",
        labelWidth : "100"
    };
};


var All = React.createClass({


    setCardNumber: function() {

    },

    render: function() {
        /* jshint ignore:start */
        return (
                <div>
                    <InputGroup labelWidth={"150"}>
                        <TargetPanel dispatcher={myDispatcher}
                                formModel={testFormModel} />
                        <ValidationField dispatcher={myDispatcher}
                                fieldKey={"field1"}
                                formModel={testFormModel}/>
                        <ValidationField dispatcher={myDispatcher}
                                fieldKey="field2"
                                formModel={testFormModel}/>
                        <ValidationField dispatcher={myDispatcher}
                                fieldKey="field3"
                                initialState= {{
                                    fieldKey: 'field3',
                                    value: '12',
                                    validator: Validate.floatRange.bind(null, 1.23, 1000, 3,"field 3"),
                                    tooltip: "more tipping",
                                    label : "Another",
                                    labelWidth : "100"
                                }}
                                formModel={testFormModel}/>
                        <FormButton dispatcher={myDispatcher}
                                formModel={testFormModel}
                                label="Submit"/>
                    </InputGroup>
                </div>
        );
        /* jshint ignore:end */
    }
});

window.onFireflyLoaded= function() {
    /* jshint ignore:start */
    React.render(<All />, document.getElementById('example'));
    /* jshint ignore:end */
};
