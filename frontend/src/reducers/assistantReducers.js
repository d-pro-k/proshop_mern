import {
  ASSISTANT_LOG_LIST_REQUEST,
  ASSISTANT_LOG_LIST_SUCCESS,
  ASSISTANT_LOG_LIST_FAIL,
} from '../constants/assistantConstants'

export const assistantLogListReducer = (state = { logs: [] }, action) => {
  switch (action.type) {
    case ASSISTANT_LOG_LIST_REQUEST:
      return { loading: true, logs: [] }
    case ASSISTANT_LOG_LIST_SUCCESS:
      return { loading: false, logs: action.payload }
    case ASSISTANT_LOG_LIST_FAIL:
      return { loading: false, error: action.payload }
    default:
      return state
  }
}
