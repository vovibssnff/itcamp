import { Pagination } from 'antd'
import type { PaginationProps } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'

/** Default page size for list + table screens (card grids may pass a smaller size). */
export const LIST_PAGE_SIZE = 20

export const listPaginationClassName = 'list-pagination'

// eslint-disable-next-line react-refresh/only-export-components
export function listShowTotal(total: number, range: [number, number]): string {
  return `${range[0]}–${range[1]} из ${total}`
}

const sharedProps = {
  showSizeChanger: false as const,
  showQuickJumper: true as const,
  showTotal: listShowTotal,
}

/** Shared Ant Table `pagination` object — same chrome as ListPagination. */
// eslint-disable-next-line react-refresh/only-export-components
export function tablePagination(overrides?: TablePaginationConfig): TablePaginationConfig {
  const { className, ...rest } = overrides ?? {}
  return {
    pageSize: LIST_PAGE_SIZE,
    ...sharedProps,
    ...rest,
    className: [listPaginationClassName, className].filter(Boolean).join(' '),
  }
}

export type ListPaginationProps = Omit<
  PaginationProps,
  'showSizeChanger' | 'showQuickJumper' | 'showTotal'
>

/** Compact list pagination: total · pages · quick jumper (RU via ConfigProvider). */
export function ListPagination({
  pageSize = LIST_PAGE_SIZE,
  className,
  ...rest
}: ListPaginationProps) {
  return (
    <Pagination
      {...rest}
      pageSize={pageSize}
      {...sharedProps}
      className={[listPaginationClassName, className].filter(Boolean).join(' ')}
    />
  )
}
