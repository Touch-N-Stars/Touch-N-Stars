// Facade over the API domain modules in src/services/api/.
// Components import this single entry point; new code may import the
// domain modules directly instead.
import systemApi from './api/system';
import phd2Api from './api/phd2';
import framingApi from './api/framing';
import imageApi from './api/image';
import sequenceApi from './api/sequence';
import mountApi from './api/mount';
import profileApi from './api/profile';
import filesystemApi from './api/filesystem';
import cameraApi from './api/camera';
import equipmentApi from './api/equipment';
import flatsApi from './api/flats';
import pinsDevicesApi from './api/pinsDevices';
import hocusfocusApi from './api/hocusfocus';
import tppaApi from './api/tppa';
import tenmicronApi from './api/tenmicron';
import pluginsApi from './api/plugins';
import atlasApi from './api/atlas';
import nativeGuiderApi from './api/nativeGuider';

const apiService = {
  ...systemApi,
  ...phd2Api,
  ...framingApi,
  ...imageApi,
  ...sequenceApi,
  ...mountApi,
  ...profileApi,
  ...filesystemApi,
  ...cameraApi,
  ...equipmentApi,
  ...flatsApi,
  ...pinsDevicesApi,
  ...hocusfocusApi,
  ...tppaApi,
  ...tenmicronApi,
  ...pluginsApi,
  ...atlasApi,
  ...nativeGuiderApi,
};

export default apiService;
