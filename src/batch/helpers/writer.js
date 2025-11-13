export const writeResult = async (result) => {
  console.log(`Email sent to: ${result.userEmail}`);
  // console.log(`Output: ${JSON.stringify(result.result)}`);
  return result;
};
export default writeResult;
