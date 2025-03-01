import {
  Box,
  Button,
  Flex,
  Stack,
  Table,
  TableContainer,
  Tag,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import {
  CancelOfferStep,
  dateFromNow,
  formatError,
  useCancelOffer,
  useIsLoggedIn,
} from '@nft/hooks'
import { useWeb3React } from '@web3-react/core'
import { NextPage } from 'next'
import Trans from 'next-translate/Trans'
import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import invariant from 'ts-invariant'
import Head from '../../../../components/Head'
import Image from '../../../../components/Image/Image'
import Link from '../../../../components/Link/Link'
import CancelOfferModal from '../../../../components/Modal/CancelOffer'
import Pagination from '../../../../components/Pagination/Pagination'
import Price from '../../../../components/Price/Price'
import UserProfileTemplate from '../../../../components/Profile'
import Select from '../../../../components/Select/Select'
import { convertBidFull, convertFullUser } from '../../../../convert'
import environment from '../../../../environment'
import {
  FetchUserBidsPlacedDocument,
  FetchUserBidsPlacedQuery,
  OfferOpenBuysOrderBy,
  useFetchUserBidsPlacedQuery,
} from '../../../../graphql'
import useBlockExplorer from '../../../../hooks/useBlockExplorer'
import useEagerConnect from '../../../../hooks/useEagerConnect'
import usePaginate from '../../../../hooks/usePaginate'
import useSigner from '../../../../hooks/useSigner'
import LargeLayout from '../../../../layouts/large'
import { getLimit, getOffset, getOrder, getPage } from '../../../../params'
import { wrapServerSideProps } from '../../../../props'

type Props = {
  userAddress: string
  now: string
  page: number
  limit: number
  offset: number
  orderBy: OfferOpenBuysOrderBy
  meta: {
    title: string
    description: string
    image: string
  }
}

export const getServerSideProps = wrapServerSideProps<Props>(
  environment.GRAPHQL_URL,
  async (context, client) => {
    const userAddress = context.params?.id
      ? Array.isArray(context.params.id)
        ? context.params.id[0].toLowerCase()
        : context.params.id.toLowerCase()
      : null
    invariant(userAddress, 'userAddress is falsy')
    const limit = getLimit(context, environment.PAGINATION_LIMIT)
    const page = getPage(context)
    const orderBy = getOrder<OfferOpenBuysOrderBy>(context, 'CREATED_AT_DESC')
    const offset = getOffset(context, environment.PAGINATION_LIMIT)
    const now = new Date()
    const { data, error } = await client.query<FetchUserBidsPlacedQuery>({
      query: FetchUserBidsPlacedDocument,
      variables: {
        limit,
        offset,
        orderBy,
        address: userAddress,
        now,
      },
    })
    if (error) throw error
    if (!data) throw new Error('data is falsy')
    return {
      props: {
        page,
        limit,
        offset,
        orderBy,
        userAddress,
        now: now.toJSON(),
        meta: {
          title: data.account?.name || userAddress,
          description: data.account?.description || '',
          image: data.account?.image || '',
        },
      },
    }
  },
)

const BidPlacedPage: NextPage<Props> = ({
  meta,
  now,
  limit,
  page,
  offset,
  orderBy,
  userAddress,
}) => {
  useEagerConnect()
  const signer = useSigner()
  const { t } = useTranslation('templates')
  const { replace, pathname, query } = useRouter()
  const { account } = useWeb3React()
  const [changePage, changeLimit] = usePaginate()
  const [cancel, { activeStep, transactionHash }] = useCancelOffer(signer)
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const ownerLoggedIn = useIsLoggedIn(userAddress)

  const date = useMemo(() => new Date(now), [now])
  const { data, refetch } = useFetchUserBidsPlacedQuery({
    variables: {
      address: userAddress,
      limit,
      offset,
      orderBy,
      now: date,
    },
  })

  const userAccount = useMemo(
    () => convertFullUser(data?.account || null, userAddress),
    [data, userAddress],
  )

  const bids = useMemo(
    () =>
      (data?.bids?.nodes || []).map((x) => ({
        ...convertBidFull(x),
        asset: x.asset,
      })),
    [data],
  )

  const blockExplorer = useBlockExplorer(
    environment.BLOCKCHAIN_EXPLORER_NAME,
    environment.BLOCKCHAIN_EXPLORER_URL,
  )

  const handleCancelOffer = useCallback(
    async (id: string) => {
      try {
        onOpen()
        await cancel({ id })
        toast({
          title: t('user.bid-placed.notifications.canceled'),
          status: 'success',
        })
        await refetch()
      } catch (e) {
        toast({
          title: formatError(e),
          status: 'error',
        })
      } finally {
        onClose()
      }
    },
    [cancel, onClose, onOpen, refetch, t, toast],
  )

  const changeOrder = useCallback(
    async (orderBy: any) => {
      await replace({ pathname, query: { ...query, orderBy } })
    },
    [replace, pathname, query],
  )
  return (
    <LargeLayout>
      <Head
        title={meta.title}
        description={meta.description}
        image={meta.image}
      />

      <UserProfileTemplate
        signer={signer}
        account={userAccount}
        currentAccount={account}
        currentTab="bids"
        totals={
          new Map([
            ['created', data?.created?.totalCount || 0],
            ['on-sale', data?.onSale?.totalCount || 0],
            ['owned', data?.owned?.totalCount || 0],
          ])
        }
        loginUrlForReferral={environment.BASE_URL + '/login'}
      >
        <Stack spacing={6}>
          <Flex
            justify={{ md: 'space-between' }}
            align={{ md: 'center' }}
            gap={4}
            direction={{ base: 'column', md: 'row' }}
          >
            <Flex as="nav" gap={2}>
              <Link href={`/users/${userAddress}/bids`}>
                <Tag
                  size="lg"
                  variant="outline"
                  borderRadius="full"
                  boxShadow="none"
                  border="1px"
                  borderColor="gray.200"
                  _hover={{
                    bgColor: 'gray.100',
                  }}
                >
                  <Text as="span" variant="text-sm" color="brand.black">
                    {t('user.bid-placed.nav.received')}
                  </Text>
                </Tag>
              </Link>
              <Link href={`/users/${userAddress}/bids/placed`}>
                <Tag
                  size="lg"
                  colorScheme="brand"
                  border="1px"
                  borderColor="brand.500"
                  borderRadius="full"
                >
                  <Text as="span" variant="text-sm" color="brand.600">
                    {t('user.bid-placed.nav.placed')}
                  </Text>
                </Tag>
              </Link>
            </Flex>
            <Box ml="auto" w={{ base: 'full', md: 'min-content' }}>
              <Select<OfferOpenBuysOrderBy>
                label={t('user.bid-placed.orderBy.label')}
                name="Sort by"
                onChange={changeOrder}
                choices={[
                  {
                    label: t('user.bid-placed.orderBy.values.createdAtDesc'),
                    value: 'CREATED_AT_DESC',
                  },
                  {
                    label: t('user.bid-placed.orderBy.values.createdAtAsc'),
                    value: 'CREATED_AT_ASC',
                  },
                ]}
                value={orderBy}
                inlineLabel
              />
            </Box>
          </Flex>

          <TableContainer bg="white" shadow="base" rounded="lg">
            <Table>
              <Thead>
                <Tr>
                  <Th>{t('user.bid-placed.table.item')}</Th>
                  <Th isNumeric>{t('user.bid-placed.table.price')}</Th>
                  <Th>{t('user.bid-placed.table.status')}</Th>
                  <Th>{t('user.bid-placed.table.created')}</Th>
                  <Th isNumeric></Th>
                </Tr>
              </Thead>
              <Tbody>
                {bids.map((item) => (
                  <Tr fontSize="sm" key={item.id}>
                    <Td>
                      <Flex gap={3}>
                        <Image
                          src={item.asset.image}
                          alt={item.asset.name}
                          width={40}
                          height={40}
                          layout="fixed"
                          objectFit="cover"
                          rounded="full"
                          h={10}
                          w={10}
                        />
                        <Flex
                          direction="column"
                          my="auto"
                          title={item.asset.name}
                        >
                          <Text as="span" noOfLines={1}>
                            {item.asset.name}
                          </Text>
                          {item.availableQuantity.gt(1) && (
                            <Text as="span" variant="caption" color="gray.500">
                              {t('user.bid-placed.requested', {
                                value: item.availableQuantity.toString(),
                              })}
                            </Text>
                          )}
                        </Flex>
                      </Flex>
                    </Td>
                    <Td isNumeric>
                      <Text
                        as={Price}
                        noOfLines={1}
                        amount={item.unitPrice.mul(item.availableQuantity)}
                        currency={item.currency}
                      />
                    </Td>
                    <Td>
                      {item.expiredAt && item.expiredAt <= new Date()
                        ? t('user.bid-placed.status.expired')
                        : t('user.bid-placed.status.active')}
                    </Td>
                    <Td>{dateFromNow(item.createdAt)}</Td>
                    <Td isNumeric>
                      {ownerLoggedIn && (
                        <>
                          {!item.expiredAt || item.expiredAt > new Date() ? (
                            <Button
                              variant="outline"
                              colorScheme="gray"
                              disabled={activeStep !== CancelOfferStep.INITIAL}
                              onClick={() => handleCancelOffer(item.id)}
                            >
                              <Text as="span" isTruncated>
                                {t('user.bid-placed.actions.cancel')}
                              </Text>
                            </Button>
                          ) : (
                            <Button
                              as={Link}
                              href={`/tokens/${item.asset.id}/bid`}
                              variant="outline"
                              colorScheme="gray"
                            >
                              <Text as="span" isTruncated>
                                {t('user.bid-placed.actions.new')}
                              </Text>
                            </Button>
                          )}
                        </>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>

          <Pagination
            limit={limit}
            limits={[environment.PAGINATION_LIMIT, 24, 36, 48]}
            onLimitChange={changeLimit}
            onPageChange={changePage}
            page={page}
            total={data?.bids?.totalCount || 0}
            result={{
              label: t('pagination.result.label'),
              caption: (props) => (
                <Trans
                  ns="templates"
                  i18nKey="pagination.result.caption"
                  values={props}
                  components={[
                    <Text as="span" color="brand.black" key="text" />,
                  ]}
                />
              ),
              pages: (props) =>
                t('pagination.result.pages', { count: props.total }),
            }}
          />

          <CancelOfferModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('user.bid-placed.cancel.title')}
            step={activeStep}
            blockExplorer={blockExplorer}
            transactionHash={transactionHash}
          />
        </Stack>
      </UserProfileTemplate>
    </LargeLayout>
  )
}

export default BidPlacedPage
