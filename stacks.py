import os
import requests
import csv
import pandas as pd
from FeatureData import FeatureData
from parse_features import *
from Classifier import Classifier
import numpy as np
import json
from flask import Flask, render_template, flash, request, redirect, jsonify, url_for, send_from_directory
from werkzeug.utils import secure_filename

DATASET_NAME = ''
DATA_FOLDER = 'static/synthetic_data1/'
UPLOAD_FOLDER = 'static/uploaded/'
ALLOWED_EXTENSIONS = set(['txt', 'csv'])

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
APP_ROOT = os.path.dirname(os.path.abspath(__file__))
APP_STATIC = os.path.join(APP_ROOT, 'static')
HISTOGRAM = None
FEATURE_DATA = None
INTERFACE_DATA = None
causalGraph = None
classifier = None
p = None
tetrad = None
prior = None
class_name = ""

def allowed_file(filename):
    return '.' in filename and \
            filename.rsplit('.',1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/', methods=['GET', 'POST'])
def upload_file():
    save_filenames = ['datafile.csv', 'names.csv', 'description.csv']
    if request.method == 'POST':
        all_files = request.files.getlist('file')
        for i, file in enumerate(all_files):
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], save_filenames[i]))
        return redirect(url_for('uploaded_file'))
    return render_template('upload.html')

@app.route("/index")
def uploaded_file():
    global DATA_FOLDER
    global DATASET_NAME
    DATA_FOLDER = UPLOAD_FOLDER
    DATASET_NAME = 'uploaded'
    return render_template('index.html')

@app.route("/demo")
def demo():
    global DATA_FOLDER
    global DATASET_NAME
    DATA_FOLDER = 'static/demo/'
    DATASET_NAME = 'demo'
    return render_template('index.html')

@app.route("/dataset1")
def dataset_1():
    global DATA_FOLDER
    global DATASET_NAME
    DATA_FOLDER = 'static/synthetic_data2/'
    DATASET_NAME = 'dataset1'
    return render_template('index.html')

@app.route("/dataset2")
def dataset_2():
    global DATA_FOLDER
    DATA_FOLDER = 'static/synthetic_data1/'
    DATASET_NAME = 'dataset2'
    return render_template('index.html')

@app.route("/getFeatures")
def get_features_data_folder():
    return initialize_data()

def initialize_data():
    des = dict()
    if os.path.exists(DATA_FOLDER + 'description.csv'):
        des = parse_description(DATA_FOLDER + 'description.csv')
    feature_names = parse_features(DATA_FOLDER + 'names.csv')
    dataframe = pd.read_csv(DATA_FOLDER + 'datafile.csv')
    global class_name
    class_name = dataframe.columns.values[-1]
    features = dataframe.drop([class_name], axis=1)
    target = pd.DataFrame(dataframe[class_name])#pd.read_csv(DATA_FOLDER + 'features.csv')#convert_csv_to_array(DATA_FOLDER + 'features.csv', False, csv.QUOTE_NONNUMERIC)
    class_values = np.sort(dataframe[class_name].unique())#convert_csv_to_array(DATA_FOLDER + 'classnames.csv', False, csv.QUOTE_ALL)

    global classifier
    classifier = Classifier(DATA_FOLDER + 'datafile.csv', class_name)

    global FEATURE_DATA
    numeric_data = classifier.df
    FEATURE_DATA = FeatureData(target, features, numeric_data, feature_names, class_values, class_name)
    interface_data = dict()
    interface_data['featureData'] = FEATURE_DATA.feature_data
    interface_data['classNames'] = list(FEATURE_DATA.class_names)
    interface_data['description'] = des
    interface_data['targetName'] = class_name
    interface_data['datasetName'] = DATASET_NAME
    return jsonify(interface_data)

def create_names(names_array):
    if len(names_array) >= 2:
        return names_array[0], names_array[1]
    elif len(names_array) == 1:
        return names_array[0], []
    else:
        return [], []

@app.route("/calculateScores", methods=["POST"])
def send_new_calculated_MI():
    if request.method == 'POST':
        data = json.loads(request.data)
        #print ("feature" + str(data['names']))
        FEATURE_DATA.calculate_mutual_information(data['features'], data['names'])
        interface_data = dict()
        interface_data['MI'] = FEATURE_DATA.MI
        return jsonify(interface_data)

@app.route("/classify", methods=['POST'])
def classify():
    if request.method == 'POST':
        features = json.loads(request.data)
        classifier.classify(features['features'])
        data = dict()
        data['accuracy'] = classifier.accuracy
        data['precision'] = classifier.precision
        data['recall'] = classifier.recall
        data['accuracyTrain'] = classifier.accuracy_train
        data['rocCurve'] = classifier.rocCurve
        data['auc'] = classifier.auc
        data['confusionMatrix'] = classifier.cm.tolist()
        data['confusionMatrixNormalized'] = classifier.cm_normalized.tolist()
        print ("features: " + str(features['features']))
        print ("accuracy: " + str(classifier.accuracy))
        print ("accuracyTrain: " + str(classifier.accuracy_train))
        print ("MI: " + str(FEATURE_DATA.MI))
    return jsonify(data)

@app.route('/classSelected', methods=['POST'])
def update_class_selection():
    if request.method == 'POST':
        class_selected = json.loads(request.data)
        FEATURE_DATA.update_class_selection(class_selected['className'], class_selected['currentDisplay'])
        interface_data = dict()
        interface_data['featureData'] = FEATURE_DATA.feature_data
    return jsonify(interface_data)

@app.route('/updateDiplay', methods=['POST'])
def update_display():
    if request.method == 'POST':
        display = request.get_json(data)
        #print display
        HISTOGRAM.set_display(display)
    return jsonify(display)

@app.route('/static/<path:path>')
def send_js(path):
    return send_from_directory('static', path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
