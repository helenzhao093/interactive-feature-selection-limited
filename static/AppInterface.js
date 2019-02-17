class AppInterface extends React.Component {
  constructor(props) {
    super(props);
    console.log(props);
    var colorRange = ["#e31a1c", "#fdbf6f", "#33a02c", "#a6cee3", "#c0392b", "#f1c40f", "#16a085", "#3498db", '#e88c5d', '#23a393' ];
    var color = d3.scaleOrdinal()
        .range(colorRange)
        .domain(props.classNames);

    var nameToIndexMap = {};
      this.props.features.features.map(feature => {
          nameToIndexMap[feature.name] = feature.index
      });

    var ROCDisplayClass = {};
    this.props.classNames.map((label) => {
      ROCDisplayClass[label] = {}
      ROCDisplayClass[label].TP = {}
      ROCDisplayClass[label].TP.display = true
    });

    let helptext = [
        "-Each axis represents a feature. \n" +
        "-Each line represents an example. The example intersects each feature axis at the value for the feature.  \n" +
        "-Default feature selection is the markov blanket of the target variable.\n" +
        "-Features to the left of the BOUNDARY line is the selected feature set.\n" +
        "-Drag axis to reposition them or add/remove them from selected feature set.",

        "-The performance of the classifier build using the selected feature set."
    ];

    /* add BOUNDARY to features object */
    this.props.features.features.unshift({
      index: this.props.features.features.length,
      display: true,
      name: "BOUNDARY",
      type: "continuous",
      range: [0, 0]
    });

    this.state = {
        datasetName: this.props.datasetName,
        nameToIndexMap: nameToIndexMap,
        helptext: helptext,
        activeTabIndex: 0,
        featureSelectionMargin : { left: 10, right: 30, top: 20, bottom:10 },
        shouldInitializeSelection: true,
        isNewTrial: false,
        selectedFeatureSelection: -1,
        featureSelectionHistory: [{ features: this.props.features.features }],
        showAnalysis: false,
        featureSelectionAxisWidthSelected: 75,
        featureSelectionAxisWidthNotSelected: 50,
        MI: [],
        MICurrent: 0,
        metrics: {
            accuracy: [],
            accuracyTrain: []
        },
        confusionMatrix: [],
        confusionMatrixNormalized: [],
        consistencyGraphLegend: [
            { value: "Mutual Information", color: "#feb24c", helptext: "Amount of information explained by selected features" }
        ],
        consistencyGraphLegendMax: 1,
        metricsGraphLegend: [
            { value: "accuracy", color: '#3690c0', helptext: "% of correct predictions " },
            { value: "train accuracy", color: '#d0d1e6', helptext: "% of correctly predicted train ex. " }
        ],
        classDisplay: this.props.features.classDisplay,
        featureData: {
            inputData: this.props.features.inputData,
            convertedData: this.props.features.convertedData
        },
        indexToFeatureMap: {},
        featureHistory: [],
        step: 0,
        dragging: {},
        colorRange: colorRange,
        colorFunction: color,
        xAxisLength: 2,
        showInfo: false,
        selectedTrial1: -1,
        selectedTrial2: -1,
        trials: [],
        rocCurve: [],
        ROCDisplayClass: ROCDisplayClass
    };
      /* FEATURE SELECTION METHODS */
    this.calculateFeatureSelectionXScale = this.calculateFeatureSelectionXScale.bind(this);
    this.featureAxisOnEnd = this.featureAxisOnEnd.bind(this);
    this.changeDisplaySelection = this.changeDisplaySelection.bind(this);
    this.goFromAnalysisToSelection = this.goFromAnalysisToSelection.bind(this);
    this.position = this.position.bind(this);
    this.classify = this.classify.bind(this);
    this.handleTabClick = this.handleTabClick.bind(this);
    this.showInfoTrue = this.showInfoTrue.bind(this);
    this.showInfoFalse = this.showInfoFalse.bind(this);
    this.changeDisplayTrial = this.changeDisplayTrial.bind(this);
    this.changeROCClassDisplay = this.changeROCClassDisplay.bind(this);
  }

  componentDidMount() {
  }

  componentDidUpdate() {
  }

/* show sidebar methods */
  showInfoTrue() {
      this.setState({
          showInfo: true
      })
  }

  showInfoFalse() {
      this.setState({
          showInfo: false
      })
  }

  handleTabClick(tabIndex) {
      /*this.setState({
          activeTabIndex: tabIndex === this.state.activeTabIndex ? this.props.defaultActiveTabIndex : tabIndex
      });*/
  }

  /* FEATURE SELECTION METHODS */
  /* calculate feature selection xscale */
  calculateFeatureSelectionXScale(features) {
      var foundBoundary = false;
      var xScaleRange = [];
      var nextPosition = 0;
      var numSelectedFeatures = 0;

      /* create array of features for the xscale */
      for (var i = 0; i < features.length; i++) {
          xScaleRange.push(nextPosition);
          if (features[i].name == "BOUNDARY") {
              foundBoundary = true;
              numSelectedFeatures = i;
          }
          if (foundBoundary) {
              nextPosition = nextPosition + this.state.featureSelectionAxisWidthNotSelected;
          } else {
              nextPosition = nextPosition + this.state.featureSelectionAxisWidthSelected;
          }
      }

      /* create feature name domain */
      var xScaleDomain = features.map((feature, index) =>
          feature.name
      );

      var xScale = d3.scaleOrdinal()
          .domain(xScaleDomain)
          .range(xScaleRange);

      var featureSelectionTotalWidth = numSelectedFeatures * this.state.featureSelectionAxisWidthSelected + (features.length - numSelectedFeatures) * this.state.featureSelectionAxisWidthNotSelected + this.state.featureSelectionMargin.left + this.state.featureSelectionMargin.right;

      return {xScale: xScale, xScaleDomain: xScaleDomain, featureSelectionTotalWidth: featureSelectionTotalWidth};
  }

    featureAxisOnEnd(element) {
        var that = this;
        var attrId = element.id;
        var stringId = '#' + attrId;
        var xScale = that.state.featureSelectionHistory[that.state.featureSelectionHistory.length - 1].xScale;
        d3.selectAll('.feature-parallels').select(stringId).attr('transform', function(d) { return 'translate(' + xScale(attrId) + ")" });
        this.state.dragging[attrId] = d3.event.x;
        var currentFeatures = this.state.featureSelectionHistory[this.state.selectedFeatureSelection].features;
        var oldFeatureNames = currentFeatures.map((feature) =>
            feature.name
        );
        var features = currentFeatures;
        features.sort(function(a, b) { return that.position(a.name) - that.position(b.name)});
        var allFeatureIndexes = features.map((feature) =>
            feature.index
        );
        var allFeatureNames = features.map((feature) =>
            feature.name
        );

        delete this.state.dragging[attrId];
        if (JSON.stringify(oldFeatureNames) != JSON.stringify(allFeatureNames)) {
            const stopIndex = allFeatureIndexes.indexOf(features.length - 1);
            allFeatureIndexes.splice(stopIndex);
            allFeatureNames.splice(stopIndex);
            var xScaleInfo = this.calculateFeatureSelectionXScale(features);
            this.calculateScores({ features: allFeatureIndexes, names: allFeatureNames });

            if (this.state.isNewTrial) {
                this.state.featureSelectionHistory.push({
                    xScale: xScaleInfo.xScale,
                    xScaleDomain: xScaleInfo.xScaleDomain,
                    features: features,
                    selectedFeatureNames: allFeatureNames,
                    featureCoordinatesSize: [xScaleInfo.featureSelectionTotalWidth, 500],
                });

            } else {
                this.state.featureSelectionHistory.splice(this.state.featureSelectionHistory.length-1, 1,
                    {
                        xScale: xScaleInfo.xScale,
                        xScaleDomain: xScaleInfo.xScaleDomain,
                        features: features,
                        selectedFeatureNames: allFeatureNames,
                        featureCoordinatesSize: [xScaleInfo.featureSelectionTotalWidth, 500],
                    }
                );

            }

            this.setState({
                isNewTrial: false,
                selectedFeatureSelection: this.state.featureSelectionHistory.length - 1,
            });

        }
    }

  classify() {
    if (this.state.MICurrent >= 0) {
      // names of features in feature set
      var currentFeatures = this.state.featureSelectionHistory[this.state.featureSelectionHistory.length - 1].features;
      var allFeatureNames = currentFeatures.map((feature) => feature.name);
      const stopIndex = allFeatureNames.indexOf("BOUNDARY");
      allFeatureNames.splice(stopIndex);
      if (allFeatureNames.length > 0) {

      const features = { "features": allFeatureNames};
      fetch('/classify', {
        method: 'POST',
        body: JSON.stringify(features)
      }).then(function(response) {
        return response.json();
      }).then(data => {
        this.state.MI.push(this.state.MICurrent);
        this.state.rocCurve.push(data.rocCurve);
        this.state.metrics.accuracyTrain.push(parseFloat(data.accuracyTrain.toFixed(3)));
        this.state.metrics.accuracy.push(parseFloat(data.accuracy.toFixed(3)));
        this.state.confusionMatrixNormalized.push(data.confusionMatrixNormalized);
        this.state.confusionMatrix.push(data.confusionMatrix);
        this.state.trials.push("trial " + String(this.state.metrics.accuracy.length));

        let lastFeatureSelection = this.state.featureSelectionHistory[this.state.featureSelectionHistory.length - 1];

        this.props.client.recordEvent('LS_classify_results', {
           user: userID,
           MI: this.state.MICurrent,
           accuracy: +data.accuracy.toFixed(3),
           selectedFeatures: allFeatureNames,
           confusionMatrix: data.confusionMatrix //
        });

        this.setState({
          isNewTrial: true,
          selectedFeatureSelection: this.state.featureSelectionHistory.length - 1,
          MI: this.state.MI,
          MICurrent: -1,
          metrics: {
            accuracy: this.state.metrics.accuracy,
            accuracyTrain: this.state.metrics.accuracyTrain
          },
          activeTabIndex: 1,
          selectedTrial1: (this.state.metrics.accuracy.length == 1) ? 0 : this.state.metrics.accuracy.length - 2,
          selectedTrial2: (this.state.metrics.accuracy.length == 1) ? -1 : this.state.metrics.accuracy.length - 1
        })
      }).catch(function(error) {
        console.log(error)
      })
    }
    } else {
        this.setState({
            activeTabIndex: 1
        })
    }
  }

  changeROCClassDisplay(label, display) {
      var classDisplay = this.state.ROCDisplayClass;
      classDisplay[label].TP.display = !display;
      this.setState({
        ROCDisplayClass: classDisplay
      });
  }

  changeDisplaySelection(event) {
      console.log(event);
      let selectedSelection = event.target.value;
      this.setState({
          selectedFeatureSelection: selectedSelection
      });
  }

  position(d) {
    var value = this.state.dragging[d];
    var currentXScale = this.state.featureSelectionHistory[this.state.selectedFeatureSelection].xScale;
    return value == null ? currentXScale(d) : value;
  }

  calculateScores(dataToSend) {
      fetch("/calculateScores", {
          method: 'POST',
          body: JSON.stringify(dataToSend)
      }).then(function(response) {
          return response.json();
      }).then(data => {
          console.log(data);
          var axisLength = this.state.xAxisLength;
          //return { MICurrent: parseFloat(data.MI.toFixed(3)), xAxisLength : axisLength }

          this.props.client.recordEvent('LS_feature_selection_exploration', {
              user: userID,
              selectedFeatures: this.state.featureSelectionHistory[this.state.featureSelectionHistory.length - 1].selectedFeatureNames,
              MI: parseFloat(data.MI.toFixed(3)),
          });

          this.setState({
            MICurrent : parseFloat(data.MI.toFixed(3)),
            xAxisLength : axisLength
          })
      }).catch(function(error) {
          console.log(error)
      });
  }

  handleClassSelection(className, currentDisplay){
      var classDisplay = this.state.classDisplay;
      classDisplay[className].TP.display = !currentDisplay;
      this.setState({
          classDisplay: classDisplay
      })
  }


    goFromAnalysisToSelection() {
        this.setState({
            activeTabIndex: 0
        })
    }

    changeDisplayTrial(event) {
        var trialStr = event.target.value;
        var classifierNum = parseInt(trialStr.substring(0,1));
        var trialNum = parseInt(trialStr.substring(1));
        console.log(classifierNum);
        console.log(trialNum);
        if (classifierNum == 1) {
          this.props.client.recordEvent('LS_compare_classifier', {
            user: userID,
            trial1: trialNum,
            trial1Features: this.state.featureSelectionHistory[trialNum].selectedFeatureNames,
            trial2: this.state.selectedTrial2,
            accuracy1: this.state.metrics.accuracy[trialNum],
            accuracy2: this.state.metrics.accuracy[this.state.selectedTrial2],
            trial2Features: this.state.featureSelectionHistory[this.state.selectedTrial2].selectedFeatureNames
          });
            this.setState({
                selectedTrial1: trialNum
            })
        } else {
          this.props.client.recordEvent('LS_compare_classifier', {
            user: userID,
            trial1: this.state.selectedTrial1,
            trial1Features: this.state.featureSelectionHistory[this.state.selectedTrial1].selectedFeatureNames,
            trial2Features: this.state.featureSelectionHistory[trialNum].selectedFeatureNames,
            trial2: trialNum,
            accuracy1: this.state.metrics.accuracy[this.state.selectedTrial1],
            accuracy2: this.state.metrics.accuracy[trialNum]
          });
            this.setState({
                selectedTrial2: trialNum
            })
        }
    }

  render() {
    // set graph max for consistency graph
    var metricsGraphMax = Math.max(this.state.consistencyGraphLegendMax, this.state.MICurrent);
    this.state.consistencyGraphLegendMax = metricsGraphMax;

    var selectedFeatureSelection;
    if (this.state.selectedFeatureSelection >= 0) {
      selectedFeatureSelection = this.state.featureSelectionHistory[this.state.selectedFeatureSelection];
    } else {
      var features = this.state.featureSelectionHistory[0].features;
      var xScaleInfo = this.calculateFeatureSelectionXScale(features);
      this.state.featureSelectionHistory[0].xScale = xScaleInfo.xScale;
      this.state.featureSelectionHistory[0].xScaleDomain = xScaleInfo.xScaleDomain;
      this.state.featureSelectionHistory[0].featureCoordinatesSize = [xScaleInfo.featureSelectionTotalWidth, 500];
      selectedFeatureSelection = this.state.featureSelectionHistory[0];
      this.state.selectedFeatureSelection = 0;
    }
    var trialLegend = (this.state.selectedTrial2 >= 0) ? [this.state.selectedTrial1, this.state.selectedTrial2] : [this.state.selectedTrial1];

    return (
        <div className={'root-div'}>
            <SideBar featureInfo={this.props.description} show={this.state.showInfo} close={() => this.showInfoFalse()}/>

            <button className={"sidebar-toggle"} onClick={this.showInfoTrue}>{"☰"}</button>
            <div className={'help-icon-tooltip'}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0z"/><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/></svg>                <span className={"tooltip-text"}>
                    {this.state.helptext[this.state.activeTabIndex]}
                </span>
            </div>

            <Tabs activeTabIndex={this.state.activeTabIndex} handleTabClick={(t) => this.handleTabClick(t)}>
              <Tab linkClassName={"Feature Selection"}>
                      <div className={"tools-bar"}>
                          <div className={"tools-bar-help"}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                              <span className={"tools-bar-help-text"}>
                                {"Analysis of how the current selected feature set relates to features importance and causal graph"}
                                </span>
                          </div>
                          <button className={"tools-bar right-button next-button"} onClick={this.classify}>{"CREATE CLASSIFER »"}</button>
                      </div>
                      <div>
                          <span>Feature Selection for: </span>
                          <select onChange={ this.changeDisplaySelection } >
                              {this.state.featureSelectionHistory.map((history, index) =>
                                  <option selected={(index == this.state.selectedFeatureSelection) ? "selected": "" } value={index}>{`trial ${index+1}`}</option>
                              )}
                          </select>
                      </div>
                      <FeatureParallelCoordinates
                          data={this.state.featureData.inputData}
                          convertedData={this.state.featureData.convertedData}
                          features={selectedFeatureSelection.features}
                          xScaleDomain={selectedFeatureSelection.xScaleDomain}
                          xScale={selectedFeatureSelection.xScale}
                          dragging={this.state.dragging}
                          featureAxisOnEnd={this.featureAxisOnEnd}
                          size={selectedFeatureSelection.featureCoordinatesSize}
                          colorFunction={this.state.colorFunction}
                          classDisplay={this.state.classDisplay}
                          nameToIndexMap={this.state.nameToIndexMap}
                      />
                      <div>
                      <div className={"className-legend-title"}>{`Displayed ${this.props.targetName}`}</div>
                      <Legend className={"legend legend-left class-legend"}
                                  keys={this.props.classNames}
                                  colors={this.state.colorRange}/>
                      <CheckboxMultiSelect options={this.state.classDisplay}
                            handleChange={(c, d) => this.handleClassSelection(c, d)}/>
                      </div>
                      <VerticalLegend style={{marginLeft : "20px"}} legend={this.state.consistencyGraphLegend} width={170}/>
                      <ProgressGraph size={[500, 300]}
                                                 yAxisLabel={"Mutual Information"}
                                                 max={this.state.consistencyGraphLegendMax}
                                                 min={0}
                                                 name={"consistency"}
                                                 scores={{ MI: (this.state.MICurrent >= 0) ? this.state.MI.concat([this.state.MICurrent]) : this.state.MI }}
                                                 colors={this.state.consistencyGraphLegend.map((item) => item.color)}
                                                 xAxisLength={this.state.xAxisLength} />
              </Tab>
              <Tab linkClassName={"Performance Analysis"}>
                  <div className={"tools-bar"}>
                      <button className={"tools-bar right-button previous-button"} onClick={this.goFromAnalysisToSelection}>{"« PREVIOUS"}</button>
                  </div>
                  <div className={"confusion-matrix-container"}>
                      <div className={"confusion-matrix-title"}>Confusion Matrix</div>
                      <CompareClassifiers changeTrial={ this.changeDisplayTrial }
                                          trials={ this.state.trials }
                                          selectedTrial1={ this.state.selectedTrial1 }
                                          selectedTrial2={ this.state.selectedTrial2 }
                                          confusionMatrices={ this.state.confusionMatrix }
                                          confusionMatricesNormalized={ this.state.confusionMatrixNormalized }
                                          classNames={this.props.classNames}/>
                  </div>
                  <div className={"confusion-matrix-title"} style={{marginLeft: "445px", marginBottom: "10px", marginTop: "20px"}}> {"ROC Curve"}</div>
                  <div className={"grid-ROC"}>
                      <RocCurve size={[400, 300]}
                            name={"one"}
                            rocCurve={this.state.rocCurve[this.state.selectedTrial1]}
                            rocCurveTwo={(this.state.selectedTrial2 >= 0) ? this.state.rocCurve[this.state.selectedTrial2] : {} }
                            colors={this.state.colorFunction}
                            displayClass={this.state.ROCDisplayClass}
                            />
                      <Legend className={"legend legend-left class-legend legendMargin"}
                              keys={this.props.classNames}
                              colors={this.state.colorRange}/>
                      <CheckboxMultiSelect options={this.state.ROCDisplayClass}
                                             handleChange={(c, d) => this.changeROCClassDisplay(c, d)}/>
                      <div className={"legend legend-left"}>
                           {trialLegend.map((item, index) =>
                               <div style={{padding: "1px", width: 100, marginLeft: "450px"}}>
                                   <div className={`roc-legend-marker ${(index == 0) ? "first-marker" : "second-marker"}`}
                                        style={{background: "white"}}></div>
                                   <p>{"trial " + item}</p>
                               </div>
                           )}
                      </div>
                  </div>
                  <div className={"confusion-matrix-title"} style={{marginLeft: "445px", marginBottom: "10px", marginTop: "20px"}}> Statistical Metrics</div>
                  <div style={{textAlign: "center"}} >
                      <ProgressGraph size={[500, 300]}
                                     yAxisLabel={"Accuracy"}
                                     max={1}
                                     min={0}
                                     name={"accuracy-graph"}
                                     scores={{ accuracy: this.state.metrics.accuracy, accuracyTrain: this.state.metrics.accuracyTrain }}
                                     colors={[this.state.metricsGraphLegend[0].color, this.state.metricsGraphLegend[1].color]}
                                     xAxisLength={this.state.xAxisLength} />
                      <VerticalLegend legend={this.state.metricsGraphLegend} width={130}  marginLeft={"450px"}/>
                  </div>
              </Tab>
          </Tabs>
        </div>
      )
  }
}

/*
<svg className={'matrix-icon'} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                              <span className={"tools-bar-help-text"} style={{float: "none"}}>
                                {""}
                              </span>

 <svg className={'matrix-icon'} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                              <span className={"tools-bar-help-text"} style={{float: "none"}}>
                                {""}
                              </span>
                       <BarGraph size={[500,300]} metrics={this.state.metrics} colors={this.state.metricsGraphLegend.map((item) => item.color)} xAxisLength={this.state.xAxisLength}/>

 */
