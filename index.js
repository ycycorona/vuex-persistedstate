import merge from 'deepmerge';
import * as shvl from 'shvl';

export default function(options, storage, key) {
  options = options || {};
  storage = options.storage || (window && window.localStorage);
  key = options.key || 'vuex';
  const expireTime = options.expireTime || 24*60*60*1000; //默认是一天
  const cancelAll = options.cancelAll || false; //是否每次进入时都清除本地储存（此时相当于本地储存无效，想让用户清除无用或者失效数据时有用）
  const exceptItems = options.exceptItems || []; //排除字段列表

  function canWriteStorage(storage) {
    try {
      storage.setItem('@@', 1);
      storage.removeItem('@@');
      return true;
    } catch (e) {}

    return false;
  }

  function getState(key, storage, value) {
    try {
      return (value = storage.getItem(key)) && typeof value !== 'undefined'
        ? JSON.parse(value)
        : undefined;
    } catch (err) {}

    return undefined;
  }

  function filter() {
    return true;
  }

/*  function getExpireTime() {
    return options.expireTime || 24*60*60*1000;
  }*/

  /**
   *
   * @param time
   * @returns {boolean}-过期：true,没过期：false
   */
  function checkExpireTime(time) {
    return (new Date()).getTime() - time > 0
  }

  function setState(key, state, storage) {
    storage.setItem('_vuexPersistedStateExpiredTime', (new Date()).getTime() + expireTime);
    return storage.setItem(key, JSON.stringify(state));
  }

  function removeExpectItem(obj, exceptItems) {
    if (!(typeof obj === 'object' && obj !== null)) {
      throw new Error('操作对象无效');
    }

    if(exceptItems && exceptItems.length >= 0) {

      exceptItems.forEach((item, index, array) => {
        if(!obj[item]) {
          return
        }
        delete obj[item];
      });

      return true;
    }

  }
  
  function reducer(state, paths) {
    return paths.length === 0
      ? state
      : paths.reduce(function(substate, path) {
        return shvl.set(substate, path, shvl.get(state, path));
      }, {});
  }

  function subscriber(store) {
    return function(handler) {
      return store.subscribe(handler);
    };
  }

  if (!canWriteStorage(storage)) {
    throw new Error('Invalid storage instance given');
  }

  return function(store) {
    if (cancelAll) {
      storage.removeItem(key);
    } else if (storage.getItem('_vuexPersistedStateExpiredTime') && checkExpireTime(storage.getItem('_vuexPersistedStateExpiredTime'))) {
      //超过设定的过期时间，删除本地储存
      storage.removeItem(key);
    }



    const savedState = shvl.get(options, 'getState', getState)(key, storage);
    if (typeof savedState === 'object' && savedState !== null) {
      removeExpectItem(savedState, exceptItems);
      store.replaceState(merge(store.state, savedState, {
        arrayMerge: options.arrayMerger || function (store, saved) { return saved },
        clone: false,
      }));
    }

    (options.subscriber || subscriber)(store)(function(mutation, state) {
      if ((options.filter || filter)(mutation)) {
        (options.setState || setState)(
          key,
          (options.reducer || reducer)(state, options.paths || []),
          storage
        );
      }
    });
  };
};
