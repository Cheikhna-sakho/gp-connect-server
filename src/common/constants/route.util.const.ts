const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;
//   let reg =
export const ROUTE_UUID_REGEX = UUID_REGEX.source;
export const ID_PARAM = `:id(${ROUTE_UUID_REGEX})`;
export const SetIdParam = <T extends string = 'id'>(param: T = 'id' as T) => {
  return `:${param}(${ROUTE_UUID_REGEX})` as const;
};
