/*** @jsx React.DOM */

const client = new KeenTracking({
    projectId: '5c461f31c9e77c0001edad40',
    writeKey: '74B3CFDF42DF2534FCCA52779C9EDBDCDC05F025A3835FAFBA386FB0E3350C0C63F96611C0E8294AA0EC3E12F765269EED3E1A9AA7EEEA6A02409A2565B4DD41EE0D6C5AB69091EE3EA4643D1E2BE8E144D20039490C4F9534FDDA4EA6A80B19'
});

var IDFun = function () {
    var userId = prompt('Please enter your ID.');
    return parseInt(userId);
    //return '_' + Math.random().toString(36).substr(2, 9);
};

console.log(client)

const userID = IDFun();
console.log(userID);

function getData(){
  return new Promise(function(resolve, reject) {
    d3.json('/getFeatures', function(error, data) {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    })
  })
}

getData()
  .then(function(data) {
    //console.log(data)
    ReactDOM.render(
        <AppInterface
            features={data.featureData}
            classNames={data.classNames}
            description={data.description}
            targetName={data.targetName}
            datasetName={data.datasetName}
        />,
      document.getElementById('root')
    );
  })
