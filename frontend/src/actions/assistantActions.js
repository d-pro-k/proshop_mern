import axios from 'axios'
import {
  ASSISTANT_LOG_LIST_REQUEST,
  ASSISTANT_LOG_LIST_SUCCESS,
  ASSISTANT_LOG_LIST_FAIL,
} from '../constants/assistantConstants'

// Admin-only: read the AI router chat logs for the dashboard.
export const listAssistantLogs = () => async (dispatch, getState) => {
  try {
    dispatch({ type: ASSISTANT_LOG_LIST_REQUEST })

    const {
      userLogin: { userInfo },
    } = getState()

    const config = {
      headers: { Authorization: `Bearer ${userInfo.token}` },
    }

    const { data } = await axios.get('/api/assistant/logs', config)

    dispatch({ type: ASSISTANT_LOG_LIST_SUCCESS, payload: data })
  } catch (error) {
    dispatch({
      type: ASSISTANT_LOG_LIST_FAIL,
      payload:
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message,
    })
  }
}
